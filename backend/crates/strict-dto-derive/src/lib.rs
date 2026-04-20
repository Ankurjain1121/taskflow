//! `#[strict_dto]` attribute — the single opt-in for strict request DTOs.
//!
//! The attribute:
//! - adds `#[derive(::serde::Deserialize)]`
//! - adds `#[serde(deny_unknown_fields)]`
//! - emits `impl strict_dto::StrictDto for <T> {}`
//!
//! Usage:
//! ```ignore
//! use strict_dto_derive::strict_dto;
//!
//! #[strict_dto]
//! #[derive(Debug)]
//! pub struct UpdateFooRequest {
//!     pub name: Option<String>,
//! }
//! ```
//!
//! Callers must NOT also write `#[derive(Deserialize)]` or
//! `#[serde(deny_unknown_fields)]` — the attribute already emits both.
//! Other derives (Debug, Clone, Default, ts_rs::TS) and `#[serde(...)]`
//! field attrs (alias, default, rename) compose normally.

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, Data, DeriveInput, Fields};

#[proc_macro_attribute]
pub fn strict_dto(_args: TokenStream, input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let (impl_generics, ty_generics, where_clause) = input.generics.split_for_impl();

    // Guard: only structs with named fields make sense for request DTOs.
    match &input.data {
        Data::Struct(s) => match &s.fields {
            Fields::Named(_) | Fields::Unit => {}
            Fields::Unnamed(_) => {
                return syn::Error::new_spanned(
                    name,
                    "#[strict_dto] requires named fields or a unit struct",
                )
                .to_compile_error()
                .into();
            }
        },
        _ => {
            return syn::Error::new_spanned(name, "#[strict_dto] only supports structs")
                .to_compile_error()
                .into();
        }
    }

    let expanded = quote! {
        #[derive(::serde::Deserialize)]
        #[serde(deny_unknown_fields)]
        #input

        impl #impl_generics ::strict_dto::StrictDto for #name #ty_generics #where_clause {}
    };

    expanded.into()
}
