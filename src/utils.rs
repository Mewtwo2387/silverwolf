const T1A: [&str; 10] = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];
const T1B: [&str; 10] = ["", "U", "D", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];
const T2: [&str; 10] = ["", "Dc", "Vg", "Tg", "Qg", "Qig", "Sxg", "Spg", "Og", "Ng"];
const T3: [&str; 10] = ["", "Ce", "De", "Te", "Qe", "Qie", "Sxe", "Spe", "Oe", "Ne"];

pub fn get_prefix(n: usize) -> String {
    if n < 10 {
        return T1A[n].to_string();
    }
    if n < 100 {
        return format!("{}{}", T1B[n % 10], T2[n / 10]);
    }
    if n < 1000 {
        return format!("{}{}{}", T1B[n % 10], T2[(n / 10) % 10], T3[n / 100]);
    }
    "OWO".to_string()
}

pub fn get_number_from_prefix(prefix: &str) -> i32 {
    for i in 0..1000 {
        if get_prefix(i) == prefix {
            return i as i32;
        }
    }
    -1
}

pub fn format(n: f64) -> String {
    format_advanced(n, false, 6.0)
}

pub fn format_advanced(n: f64, always_fixed: bool, shorten_threshold: f64) -> String {
    if !n.is_finite() {
        return "0".to_string();
    }

    let formatted_num: String;

    if always_fixed {
        formatted_num = format!("{:.2}", n);
    } else {
        let abs_n = n.abs();
        let magnitude = if abs_n > 0.0 { abs_n.log10().floor() } else { 0.0 };

        if magnitude >= shorten_threshold && abs_n >= 1000.0 {
            let prefix_idx = (magnitude / 3.0).floor() as usize - 1;
            let prefix = get_prefix(prefix_idx);
            let magnitude_used = (magnitude / 3.0).floor() * 3.0;
            let num_used = n / 10.0f64.powf(magnitude_used);
            return format!("{:.3}{}", num_used, prefix);
        }

        let s = format!("{}", n);
        let decimal_index = s.find('.');

        if let Some(idx) = decimal_index {
            if s.len() - idx - 1 <= 2 {
                formatted_num = s;
            } else {
                formatted_num = format!("{:.2}", n);
            }
        } else {
            formatted_num = s;
        }
    }

    format_with_commas(formatted_num)
}

fn format_with_commas(s: String) -> String {
    let parts: Vec<&str> = s.split('.').collect();
    let int_part = parts[0];
    let mut result = String::new();
    let is_negative = int_part.starts_with('-');
    let abs_int = if is_negative { &int_part[1..] } else { int_part };
    
    let len = abs_int.len();
    for (i, c) in abs_int.chars().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            result.push(',');
        }
        result.push(c);
    }
    
    let mut final_result = if is_negative { format!("-{}", result) } else { result };
    if parts.len() > 1 {
        final_result.push('.');
        final_result.push_str(parts[1]);
    }
    final_result
}

pub fn anti_format(s: &str) -> f64 {
    let cleaned = s.replace(',', "");
    if let Ok(val) = cleaned.parse::<f64>() {
        return val;
    }

    let re = regex::Regex::new(r"^([0-9.]+)([a-zA-Z]+)$").unwrap();
    if let Some(caps) = re.captures(&cleaned) {
        let number = caps.get(1).unwrap().as_str().parse::<f64>().unwrap_or(f64::NAN);
        let prefix = caps.get(2).unwrap().as_str();
        
        let n = get_number_from_prefix(prefix);
        if n == -1 {
            return f64::NAN;
        }
        
        let exponent = n * 3 + 3;
        return number * 10.0f64.powi(exponent);
    }
    
    f64::NAN
}

pub fn parse_hex(hex: &str) -> u32 {
    let cleaned = hex.trim_start_matches('#');
    u32::from_str_radix(cleaned, 16).unwrap_or(0xFFFFFF)
}

pub enum BetResult {
    Valid(f64),
    Invalid,
    Negative,
    InsufficientFunds,
    Infinity,
}

pub async fn check_valid_bet_raw(db: &crate::database::Database, user_id: &str, amount_str: &str) -> anyhow::Result<BetResult> {
    let lower = amount_str.to_lowercase();
    let infinity_keywords = ["infinity", "inf", "∞", "unlimited", "forever", "endless", "neverending", "boundless", "limitless", "eternal", "never-ending"];
    
    if infinity_keywords.iter().any(|k| lower.contains(k)) {
        return Ok(BetResult::Infinity);
    }

    let amount = anti_format(amount_str);
    if amount.is_nan() {
         return Ok(BetResult::Invalid);
    }
    
    if amount < 0.0 {
        return Ok(BetResult::Negative);
    }

    let user = db.get_user(user_id).await?;
    if amount > user.credits {
        return Ok(BetResult::InsufficientFunds);
    }

    Ok(BetResult::Valid(amount))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_prefix() {
        assert_eq!(get_prefix(0), "K");
        assert_eq!(get_prefix(1), "M");
        assert_eq!(get_prefix(9), "No");
        assert_eq!(get_prefix(10), "Dc");
        assert_eq!(get_prefix(11), "UDc");
        assert_eq!(get_prefix(69), "NoSxg");
        assert_eq!(get_prefix(100), "Ce");
        assert_eq!(get_prefix(101), "UCe");
        assert_eq!(get_prefix(999), "NoNgNe");
        assert_eq!(get_prefix(1000), "OWO");
    }

    #[test]
    fn test_get_number_from_prefix() {
        assert_eq!(get_number_from_prefix("K"), 0);
        assert_eq!(get_number_from_prefix("M"), 1);
        assert_eq!(get_number_from_prefix("No"), 9);
        assert_eq!(get_number_from_prefix("Dc"), 10);
        assert_eq!(get_number_from_prefix("UDc"), 11);
        assert_eq!(get_number_from_prefix("NoSxg"), 69);
        assert_eq!(get_number_from_prefix("Ce"), 100);
        assert_eq!(get_number_from_prefix("UCe"), 101);
        assert_eq!(get_number_from_prefix("NoNgNe"), 999);
        assert_eq!(get_number_from_prefix(""), -1);
        assert_eq!(get_number_from_prefix("U"), -1);
        assert_eq!(get_number_from_prefix("Silverwolf"), -1);
    }

    #[test]
    fn test_format() {
        assert_eq!(format(123.0), "123");
        assert_eq!(format(123.45), "123.45");
        assert_eq!(format(123.456), "123.46");
        assert_eq!(format(0.123456), "0.12");
        assert_eq!(format(1234.0), "1,234");
        assert_eq!(format(123456.789), "123,456.79");
        assert_eq!(format(1234567.0), "1.235M");
        assert_eq!(format(123456789.0), "123.457M");
        assert_eq!(format(1234567890.0), "1.235B");
        assert_eq!(format(1e33), "1.000Dc");
        
        assert_eq!(format_advanced(123.0, false, 1.0), "123");
        assert_eq!(format_advanced(1234.0, false, 1.0), "1.234K");
        assert_eq!(format_advanced(1234567890.0, false, 12.0), "1,234,567,890");
        assert_eq!(format_advanced(1234567890123.0, false, 12.0), "1.235T");

        assert_eq!(format_advanced(0.123456, true, 6.0), "0.12");
        assert_eq!(format_advanced(0.1, true, 6.0), "0.10");
        assert_eq!(format_advanced(1.0, true, 6.0), "1.00");
        assert_eq!(format_advanced(1234.56789, true, 6.0), "1,234.57");
    }

    #[test]
    fn test_anti_format() {
        assert_eq!(anti_format("123"), 123.0);
        assert_eq!(anti_format("123.456"), 123.456);
        assert_eq!(anti_format("1000000000000"), 1e12);
        assert_eq!(anti_format("1.235M"), 1235000.0);
        assert_eq!(anti_format("123.457M"), 123457000.0);
        assert_eq!(anti_format("1.235B"), 1235000000.0);
        assert!((anti_format("1.000Dc") - 1e33).abs() < 1e21); // Tolerance check
        assert_eq!(anti_format("1,234"), 1234.0);
        assert_eq!(anti_format("1,234,567.89"), 1234567.89);
        assert!(anti_format("").is_nan());
        assert!(anti_format("Dc").is_nan());
        assert!(anti_format("1U").is_nan());
    }
}
