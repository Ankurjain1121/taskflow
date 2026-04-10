pub mod audit_queries;
pub mod project_types;
pub mod trash_queries;

/// Serde helper for `Option<Option<T>>` so JSON fields can distinguish
/// "absent" (`None`) from "explicitly null" (`Some(None)`).
///
/// Use with `#[serde(default, with = "crate::routes::helpers::double_option")]`.
pub mod double_option {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<T, S>(value: &Option<Option<T>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        T: Serialize,
        S: Serializer,
    {
        match value {
            Some(inner) => inner.serialize(serializer),
            // Field was never set → don't emit
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
    where
        T: Deserialize<'de>,
        D: Deserializer<'de>,
    {
        // When the field IS present (even as JSON null), this is called,
        // and we wrap the resulting Option<T> in Some(...).
        Option::<T>::deserialize(deserializer).map(Some)
    }
}
