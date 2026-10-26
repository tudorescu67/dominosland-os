// Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.
// Parserele iau &str ca sa fie testabile fara /proc real.
use crate::json;
use std::fs;

pub struct Status {
    pub os: String,
    pub hostname: Option<String>,
    pub kernel: Option<String>,
    pub uptime_seconds: Option<u64>,
    pub load: Option<[f64; 3]>,
    pub total_kb: Option<u64>,
    pub available_kb: Option<u64>,
    pub cpus: Option<usize>,
}

pub fn parse_os_release(text: &str) -> Option<String> {
    let v = text.lines().find_map(|l| l.strip_prefix("PRETTY_NAME="))?;
    let v = v.trim();
    let v = v
        .strip_prefix('"')
        .and_then(|x| x.strip_suffix('"'))
        .or_else(|| v.strip_prefix('\'').and_then(|x| x.strip_suffix('\'')))
        .unwrap_or(v);
    // os-release foloseste escape-uri shell; le acoperim pe cele uzuale.
    let v = v.replace("\\\"", "\"").replace("\\\\", "\\");
    if v.is_empty() {
        None
    } else {
        Some(v)
    }
}

pub fn parse_uptime(text: &str) -> Option<u64> {
    let secs: f64 = text.split_whitespace().next()?.parse().ok()?;
    if secs.is_finite() && secs >= 0.0 {
        Some(secs.floor() as u64)
    } else {
        None
    }
}

pub fn parse_loadavg(text: &str) -> Option<[f64; 3]> {
    let mut it = text.split_whitespace();
    let mut out = [0.0; 3];
    for slot in out.iter_mut() {
        let v: f64 = it.next()?.parse().ok()?;
        if !v.is_finite() {
            return None;
        }
        *slot = v;
    }
    Some(out)
}

/// (MemTotal, MemAvailable) in kB; fiecare lipsa devine None.
pub fn parse_meminfo(text: &str) -> (Option<u64>, Option<u64>) {
    let field = |name: &str| -> Option<u64> {
        text.lines()
            .find_map(|l| l.strip_prefix(name)?.strip_prefix(':'))?
            .split_whitespace()
            .next()?
            .parse()
            .ok()
    };
    (field("MemTotal"), field("MemAvailable"))
}

fn read_trim(path: &str) -> Option<String> {
    let s = fs::read_to_string(path).ok()?;
    let s = s.trim();
    (!s.is_empty()).then(|| s.to_string())
}

pub fn collect() -> Status {
    let (total_kb, available_kb) = fs::read_to_string("/proc/meminfo")
        .map(|t| parse_meminfo(&t))
        .unwrap_or((None, None));
    Status {
        os: fs::read_to_string("/etc/os-release")
            .ok()
            .and_then(|t| parse_os_release(&t))
            .unwrap_or_else(|| "Linux".to_string()),
        hostname: read_trim("/proc/sys/kernel/hostname"),
        kernel: read_trim("/proc/sys/kernel/osrelease"),
        uptime_seconds: fs::read_to_string("/proc/uptime")
            .ok()
            .and_then(|t| parse_uptime(&t)),
        load: fs::read_to_string("/proc/loadavg")
            .ok()
            .and_then(|t| parse_loadavg(&t)),
        total_kb,
        available_kb,
        cpus: std::thread::available_parallelism().ok().map(|n| n.get()),
    }
}

fn opt<T>(v: Option<T>, f: impl Fn(T) -> String) -> String {
    v.map(f).unwrap_or_else(|| "null".to_string())
}

impl Status {
    pub fn to_json(&self, pretty: bool) -> String {
        let (nl, ind, ind2) = if pretty { ("\n", "  ", "    ") } else { ("", "", "") };
        let sp = if pretty { " " } else { "" };
        let load = opt(self.load, |l| format!("[{},{}{},{}{}]", l[0], sp, l[1], sp, l[2]));
        format!(
            "{{{nl}{ind}\"os\":{sp}{os},{nl}{ind}\"hostname\":{sp}{host},{nl}{ind}\"kernel\":{sp}{kern},{nl}\
             {ind}\"uptime_seconds\":{sp}{up},{nl}{ind}\"load\":{sp}{load},{nl}\
             {ind}\"memory\":{sp}{{{nl}{ind2}\"total_kb\":{sp}{tot},{nl}{ind2}\"available_kb\":{sp}{av}{nl}{ind}}},{nl}\
             {ind}\"cpus\":{sp}{cpus}{nl}}}",
            os = json::string(&self.os),
            host = opt(self.hostname.as_deref(), json::string),
            kern = opt(self.kernel.as_deref(), json::string),
            up = opt(self.uptime_seconds, |v| v.to_string()),
            tot = opt(self.total_kb, |v| v.to_string()),
            av = opt(self.available_kb, |v| v.to_string()),
            cpus = opt(self.cpus, |v| v.to_string()),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn os_release() {
        let t = "NAME=\"Debian GNU/Linux\"\nPRETTY_NAME=\"Debian GNU/Linux 13 (trixie)\"\nID=debian\n";
        assert_eq!(parse_os_release(t).as_deref(), Some("Debian GNU/Linux 13 (trixie)"));
        assert_eq!(parse_os_release("PRETTY_NAME=Plain\n").as_deref(), Some("Plain"));
        assert_eq!(parse_os_release("ID=x\n"), None);
    }

    #[test]
    fn uptime() {
        assert_eq!(parse_uptime("12345.67 9999.00\n"), Some(12345));
        assert_eq!(parse_uptime("abc"), None);
        assert_eq!(parse_uptime(""), None);
    }

    #[test]
    fn loadavg() {
        assert_eq!(parse_loadavg("0.52 0.40 0.31 1/234 5678\n"), Some([0.52, 0.40, 0.31]));
        assert_eq!(parse_loadavg("0.5 0.4"), None);
    }

    #[test]
    fn meminfo() {
        let t = "MemTotal:       16384000 kB\nMemFree:  100 kB\nMemAvailable:    8000000 kB\n";
        assert_eq!(parse_meminfo(t), (Some(16384000), Some(8000000)));
        assert_eq!(parse_meminfo("MemTotal: 5 kB\n"), (Some(5), None));
        assert_eq!(parse_meminfo(""), (None, None));
    }

    #[test]
    fn json_shape_and_nulls() {
        let s = Status {
            os: "Linux".into(),
            hostname: None,
            kernel: Some("6.1".into()),
            uptime_seconds: Some(3),
            load: Some([0.1, 0.2, 0.3]),
            total_kb: Some(10),
            available_kb: None,
            cpus: Some(4),
        };
        assert_eq!(
            s.to_json(false),
            "{\"os\":\"Linux\",\"hostname\":null,\"kernel\":\"6.1\",\"uptime_seconds\":3,\"load\":[0.1,0.2,0.3],\"memory\":{\"total_kb\":10,\"available_kb\":null},\"cpus\":4}"
        );
        assert!(s.to_json(true).contains("\n  \"os\": \"Linux\""));
    }
}
