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

/// Valoare dintr-un obiect plat: cererile de actiune nu au nevoie de numere sau structuri,
/// iar un parser mai mic are mai putine locuri unde sa gresim.
#[derive(Debug, PartialEq)]
pub enum Value {
    Str(String),
    Bool(bool),
    Null,
}

/// Obiect JSON plat (chei unice). Imbricarea, listele si numerele sunt respinse.
#[derive(Debug, Default, PartialEq)]
pub struct Flat(Vec<(String, Value)>);

impl Flat {
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.0.iter().find(|(k, _)| k == key).map(|(_, v)| v)
    }
    pub fn get_str(&self, key: &str) -> Option<&str> {
        match self.get(key) {
            Some(Value::Str(s)) => Some(s),
            _ => None,
        }
    }
    pub fn get_bool(&self, key: &str) -> Option<bool> {
        match self.get(key) {
            Some(Value::Bool(b)) => Some(*b),
            _ => None,
        }
    }
}

struct P<'a> {
    b: &'a [u8],
    i: usize,
}

impl P<'_> {
    fn ws(&mut self) {
        while matches!(self.b.get(self.i), Some(b' ' | b'\t' | b'\r' | b'\n')) {
            self.i += 1;
        }
    }
    fn eat(&mut self, c: u8) -> Option<()> {
        (self.b.get(self.i) == Some(&c)).then(|| self.i += 1)
    }
    fn lit(&mut self, w: &str) -> Option<()> {
        self.b[self.i..].starts_with(w.as_bytes()).then(|| self.i += w.len())
    }
    fn hex4(&mut self) -> Option<u32> {
        let h = std::str::from_utf8(self.b.get(self.i..self.i + 4)?).ok()?;
        if !h.bytes().all(|c| c.is_ascii_hexdigit()) {
            return None;
        }
        self.i += 4;
        u32::from_str_radix(h, 16).ok()
    }
    fn string(&mut self) -> Option<String> {
        self.eat(b'"')?;
        let mut out: Vec<u8> = Vec::new();
        loop {
            let c = *self.b.get(self.i)?;
            self.i += 1;
            match c {
                b'"' => return String::from_utf8(out).ok(),
                0..=0x1f => return None,
                b'\\' => {
                    let e = *self.b.get(self.i)?;
                    self.i += 1;
                    let ch = match e {
                        b'"' => '"',
                        b'\\' => '\\',
                        b'/' => '/',
                        b'b' => '\u{8}',
                        b'f' => '\u{c}',
                        b'n' => '\n',
                        b'r' => '\r',
                        b't' => '\t',
                        b'u' => {
                            let hi = self.hex4()?;
                            let cp = if (0xD800..0xDC00).contains(&hi) {
                                self.lit("\\u")?;
                                let lo = self.hex4()?;
                                if !(0xDC00..0xE000).contains(&lo) {
                                    return None;
                                }
                                0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00)
                            } else {
                                hi
                            };
                            // O jumatate de pereche izolata nu e Unicode valid: char::from_u32 o respinge.
                            char::from_u32(cp)?
                        }
                        _ => return None,
                    };
                    let mut buf = [0u8; 4];
                    out.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
                }
                c => out.push(c),
            }
        }
    }
    fn value(&mut self) -> Option<Value> {
        match self.b.get(self.i)? {
            b'"' => self.string().map(Value::Str),
            b't' => self.lit("true").map(|_| Value::Bool(true)),
            b'f' => self.lit("false").map(|_| Value::Bool(false)),
            b'n' => self.lit("null").map(|_| Value::Null),
            _ => None,
        }
    }
}

/// None = JSON invalid sau in afara formei acceptate (obiect plat).
pub fn parse_flat(s: &str) -> Option<Flat> {
    let mut p = P { b: s.as_bytes(), i: 0 };
    let mut items: Vec<(String, Value)> = Vec::new();
    p.ws();
    p.eat(b'{')?;
    p.ws();
    if p.eat(b'}').is_none() {
        loop {
            p.ws();
            let k = p.string()?;
            p.ws();
            p.eat(b':')?;
            p.ws();
            let v = p.value()?;
            // Chei duplicate = ambiguitate; mai sigur sa respingem.
            if items.iter().any(|(x, _)| *x == k) {
                return None;
            }
            items.push((k, v));
            p.ws();
            if p.eat(b',').is_some() {
                continue;
            }
            p.eat(b'}')?;
            break;
        }
    }
    p.ws();
    (p.i == p.b.len()).then_some(Flat(items))
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

    #[test]
    fn flat_valid() {
        let f = parse_flat(" { \"on\" : true, \"t\":\"a b\", \"n\":null, \"f\":false } ").unwrap();
        assert_eq!(f.get_bool("on"), Some(true));
        assert_eq!(f.get_bool("f"), Some(false));
        assert_eq!(f.get_str("t"), Some("a b"));
        assert_eq!(f.get("n"), Some(&Value::Null));
        assert_eq!(f.get_str("on"), None);
        assert_eq!(parse_flat("{}").unwrap(), Flat::default());
    }

    #[test]
    fn flat_escapes_and_unicode() {
        let f = parse_flat(r#"{"a":"q\" b\\ \/ \b\f\n\r\t \u0041 \u021b \ud83d\ude00 țară"}"#).unwrap();
        assert_eq!(f.get_str("a"), Some("q\" b\\ / \u{8}\u{c}\n\r\t A ț 😀 țară"));
    }

    #[test]
    fn flat_invalid() {
        for s in [
            "", "[]", "{", "}", "{\"a\"}", "{\"a\":1}", "{\"a\":[]}", "{\"a\":{}}", "{\"a\":true,}",
            "{\"a\":true} x", "{\"a\":\"x\",\"a\":\"y\"}", "{'a':true}", "{\"a\":\"\\x\"}",
            "{\"a\":\"\\ud83d\"}", "{\"a\":\"\\ude00\"}", "{\"a\":\"\\u12\"}", "{\"a\":\"x\ny\"}",
            "{\"a\":tru}", "{\"a\":\"x", "\"s\"",
        ] {
            assert!(parse_flat(s).is_none(), "{s:?}");
        }
    }
}
