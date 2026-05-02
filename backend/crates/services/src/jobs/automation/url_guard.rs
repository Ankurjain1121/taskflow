//! SSRF guard for outbound webhook URLs.
//!
//! Rejects user-supplied URLs that target private/loopback/link-local/metadata
//! addresses or non-https schemes. Resolves DNS once and validates resolved IPs.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use tokio::net::lookup_host;
use url::{Host, Url};

#[derive(Debug, thiserror::Error)]
pub enum UrlGuardError {
    #[error("URL parse failed: {0}")]
    Parse(String),
    #[error("scheme not allowed: only https permitted")]
    BadScheme,
    #[error("missing host")]
    NoHost,
    #[error("DNS resolution failed: {0}")]
    Dns(String),
    #[error("rejected: address resolves to private/loopback/link-local/metadata range")]
    PrivateAddress,
}

/// Validate and resolve a webhook URL. Returns the resolved (host, port, ip) tuple
/// the caller should use; reject if scheme/host/IP is unsafe.
pub async fn validate_webhook_url(raw: &str) -> Result<Url, UrlGuardError> {
    let parsed = Url::parse(raw).map_err(|e| UrlGuardError::Parse(e.to_string()))?;

    if parsed.scheme() != "https" {
        return Err(UrlGuardError::BadScheme);
    }

    let host = parsed.host().ok_or(UrlGuardError::NoHost)?;

    match host {
        Host::Ipv4(ip) => {
            if is_private_v4(ip) {
                return Err(UrlGuardError::PrivateAddress);
            }
        }
        Host::Ipv6(ip) => {
            if is_private_v6(ip) {
                return Err(UrlGuardError::PrivateAddress);
            }
        }
        Host::Domain(name) => {
            let port = parsed.port().unwrap_or(443);
            let resolved = lookup_host((name, port))
                .await
                .map_err(|e| UrlGuardError::Dns(e.to_string()))?;
            let mut any = false;
            for addr in resolved {
                any = true;
                match addr.ip() {
                    IpAddr::V4(v4) if is_private_v4(v4) => {
                        return Err(UrlGuardError::PrivateAddress);
                    }
                    IpAddr::V6(v6) if is_private_v6(v6) => {
                        return Err(UrlGuardError::PrivateAddress);
                    }
                    _ => {}
                }
            }
            if !any {
                return Err(UrlGuardError::Dns("no addresses resolved".into()));
            }
        }
    }

    Ok(parsed)
}

fn is_private_v4(ip: Ipv4Addr) -> bool {
    if ip.is_loopback() || ip.is_link_local() || ip.is_broadcast() || ip.is_documentation() {
        return true;
    }
    if ip.is_unspecified() || ip.is_multicast() {
        return true;
    }
    let octets = ip.octets();
    // RFC1918 private
    if octets[0] == 10 {
        return true;
    }
    if octets[0] == 172 && (16..=31).contains(&octets[1]) {
        return true;
    }
    if octets[0] == 192 && octets[1] == 168 {
        return true;
    }
    // CGNAT 100.64.0.0/10
    if octets[0] == 100 && (64..=127).contains(&octets[1]) {
        return true;
    }
    // Cloud metadata 169.254.0.0/16 already covered by link_local
    // Private benchmarking 198.18.0.0/15
    if octets[0] == 198 && (octets[1] == 18 || octets[1] == 19) {
        return true;
    }
    false
}

fn is_private_v6(ip: Ipv6Addr) -> bool {
    if ip.is_loopback() || ip.is_unspecified() || ip.is_multicast() {
        return true;
    }
    let segs = ip.segments();
    // Unique local fc00::/7
    if segs[0] & 0xfe00 == 0xfc00 {
        return true;
    }
    // Link-local fe80::/10
    if segs[0] & 0xffc0 == 0xfe80 {
        return true;
    }
    // IPv4-mapped: extract v4 and recheck
    if segs[0] == 0
        && segs[1] == 0
        && segs[2] == 0
        && segs[3] == 0
        && segs[4] == 0
        && segs[5] == 0xffff
    {
        let v4 = Ipv4Addr::new(
            (segs[6] >> 8) as u8,
            (segs[6] & 0xff) as u8,
            (segs[7] >> 8) as u8,
            (segs[7] & 0xff) as u8,
        );
        return is_private_v4(v4);
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rejects_http_scheme() {
        let r = validate_webhook_url("http://example.com/hook").await;
        assert!(matches!(r, Err(UrlGuardError::BadScheme)));
    }

    #[tokio::test]
    async fn rejects_file_scheme() {
        let r = validate_webhook_url("file:///etc/passwd").await;
        assert!(matches!(r, Err(UrlGuardError::BadScheme)));
    }

    #[tokio::test]
    async fn rejects_loopback_v4() {
        let r = validate_webhook_url("https://127.0.0.1/hook").await;
        assert!(matches!(r, Err(UrlGuardError::PrivateAddress)));
    }

    #[tokio::test]
    async fn rejects_private_rfc1918() {
        let r = validate_webhook_url("https://10.10.10.3/hook").await;
        assert!(matches!(r, Err(UrlGuardError::PrivateAddress)));
        let r = validate_webhook_url("https://192.168.1.1/hook").await;
        assert!(matches!(r, Err(UrlGuardError::PrivateAddress)));
        let r = validate_webhook_url("https://172.16.0.5/hook").await;
        assert!(matches!(r, Err(UrlGuardError::PrivateAddress)));
    }

    #[tokio::test]
    async fn rejects_metadata_link_local() {
        let r = validate_webhook_url("https://169.254.169.254/latest/meta-data").await;
        assert!(matches!(r, Err(UrlGuardError::PrivateAddress)));
    }

    #[tokio::test]
    async fn rejects_loopback_v6() {
        let r = validate_webhook_url("https://[::1]/hook").await;
        assert!(matches!(r, Err(UrlGuardError::PrivateAddress)));
    }

    #[tokio::test]
    async fn rejects_unique_local_v6() {
        let r = validate_webhook_url("https://[fc00::1]/hook").await;
        assert!(matches!(r, Err(UrlGuardError::PrivateAddress)));
    }
}
