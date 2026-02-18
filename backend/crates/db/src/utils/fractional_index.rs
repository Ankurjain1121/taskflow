/// Generates a key between two optional keys for fractional indexing.
///
/// Used for ordering columns and tasks in a Kanban board without
/// requiring sequential integer positions (which cause cascade updates).
///
/// Keys are strings that sort lexicographically. Inserting between
/// two keys produces a new key that sorts between them.
///
/// # Examples
/// ```
/// use taskflow_db::utils::generate_key_between;
///
/// // First item (no neighbors)
/// let first = generate_key_between(None, None);
/// assert_eq!(first, "a0");
///
/// // After first item
/// let second = generate_key_between(Some(&first), None);
/// assert!(second > first);
///
/// // Between two items
/// let middle = generate_key_between(Some(&first), Some(&second));
/// assert!(middle > first && middle < second);
/// ```
pub fn generate_key_between(lower: Option<&str>, upper: Option<&str>) -> String {
    match (lower, upper) {
        (None, None) => "a0".to_string(),
        (None, Some(upper)) => {
            decrement_key(upper)
        }
        (Some(lower), None) => {
            increment_key(lower)
        }
        (Some(lower), Some(upper)) => {
            midpoint(lower, upper)
        }
    }
}

fn increment_key(key: &str) -> String {
    let mut chars: Vec<char> = key.chars().collect();
    let mut i = chars.len() - 1;

    loop {
        let c = chars[i];
        if c < 'z' {
            chars[i] = next_char(c);
            return chars.into_iter().collect();
        }
        // Carry over
        if i == 0 {
            // All chars maxed out, append
            let mut result: String = chars.into_iter().collect();
            result.push('1');
            return result;
        }
        chars[i] = '0';
        i -= 1;
    }
}

fn decrement_key(key: &str) -> String {
    let mut chars: Vec<char> = key.chars().collect();
    let mut i = chars.len() - 1;

    loop {
        let c = chars[i];
        if c > '0' {
            chars[i] = prev_char(c);
            return chars.into_iter().collect();
        }
        if i == 0 {
            // Prepend a character
            let mut result = String::from("Z");
            result.push_str(&chars.into_iter().collect::<String>());
            return result;
        }
        chars[i] = 'z';
        i -= 1;
    }
}

fn midpoint(lower: &str, upper: &str) -> String {
    let lower_chars: Vec<char> = lower.chars().collect();
    let upper_chars: Vec<char> = upper.chars().collect();
    let max_len = lower_chars.len().max(upper_chars.len());

    let mut result = Vec::new();

    for i in 0..max_len {
        let lc = if i < lower_chars.len() {
            char_to_val(lower_chars[i])
        } else {
            0
        };
        let uc = if i < upper_chars.len() {
            char_to_val(upper_chars[i])
        } else {
            36 // one past 'z' equivalent
        };

        if lc < uc - 1 {
            // There's room between these chars
            let mid = (lc + uc) / 2;
            result.push(val_to_char(mid));
            return result.into_iter().collect();
        }

        // Same or adjacent chars, carry to next position
        result.push(if i < lower_chars.len() {
            lower_chars[i]
        } else {
            '0'
        });
    }

    // If we get here, strings are equal or adjacent at all positions
    // Append a middle character
    result.push('V');
    result.into_iter().collect()
}

fn char_to_val(c: char) -> u32 {
    match c {
        '0'..='9' => c as u32 - '0' as u32,
        'A'..='Z' => c as u32 - 'A' as u32 + 10,
        'a'..='z' => c as u32 - 'a' as u32 + 10,
        _ => 0,
    }
}

fn val_to_char(v: u32) -> char {
    if v < 10 {
        (b'0' + v as u8) as char
    } else {
        (b'a' + (v - 10) as u8) as char
    }
}

fn next_char(c: char) -> char {
    match c {
        '0'..='8' => (c as u8 + 1) as char,
        '9' => 'a',
        'a'..='y' => (c as u8 + 1) as char,
        _ => 'z',
    }
}

fn prev_char(c: char) -> char {
    match c {
        '1'..='9' => (c as u8 - 1) as char,
        'a' => '9',
        'b'..='z' => (c as u8 - 1) as char,
        _ => '0',
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_first_key() {
        assert_eq!(generate_key_between(None, None), "a0");
    }

    #[test]
    fn test_after_key() {
        let k = generate_key_between(Some("a0"), None);
        assert!(k.as_str() > "a0");
    }

    #[test]
    fn test_before_key() {
        let k = generate_key_between(None, Some("a0"));
        assert!(k.as_str() < "a0");
    }

    #[test]
    fn test_between_keys() {
        let mid = generate_key_between(Some("a0"), Some("a2"));
        assert!(mid.as_str() > "a0");
        assert!(mid.as_str() < "a2");
    }

    #[test]
    fn test_ordering_sequence() {
        let k1 = generate_key_between(None, None);
        let k2 = generate_key_between(Some(&k1), None);
        let k3 = generate_key_between(Some(&k2), None);
        assert!(k1 < k2);
        assert!(k2 < k3);
    }

    #[test]
    fn test_insert_between_sequence() {
        let k1 = "a0".to_string();
        let k2 = "a1".to_string();
        let mid = generate_key_between(Some(&k1), Some(&k2));
        assert!(mid > k1);
        assert!(mid < k2);
    }
}
