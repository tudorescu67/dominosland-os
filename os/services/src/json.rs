// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
// Scriem JSON de mana ca sa nu depindem de crate-uri externe (build offline).

/// Escapeaza un text pentru a fi pus intre ghilimele intr-un document JSON.
pub fn escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

/// Text JSON complet, cu ghilimele.
pub fn string(s: &str) -> String {
    format!("\"{}\"", escape(s))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_special_chars() {
        assert_eq!(escape("a\"b\\c"), "a\\\"b\\\\c");
        assert_eq!(escape("l1\nl2\t\r"), "l1\\nl2\\t\\r");
        assert_eq!(escape("\u{1}\u{1f}"), "\\u0001\\u001f");
    }

    #[test]
    fn keeps_unicode() {
        assert_eq!(string("țară"), "\"țară\"");
    }
}
