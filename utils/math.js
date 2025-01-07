// When alwaysFixed is false, return up to 2 d.p. Used in credits.
// format(1234) => "1,234"
// format(1234.1) => "1,234.1"
// format(1234.1234) => "1,234.12"
// When alwaysFixed is true, always return 2 d.p. Used in multipliers and percentages.
// format(1234, true) => "1,234.00"
// format(1234.1, true) => "1,234.10"
// format(1234.1234, true) => "1,234.12"
// Shorten numbers above a magnitude of shortenThreshold.
// format(1234567, false, 9) => "1,234,567"
// format(1234567, false, 6) => "1.235M"
function format(num, alwaysFixed = false, shortenThreshold = 6){
    let formattedNum;
    
    const magnitude = Math.floor(Math.log10(num));
    if (magnitude >= shortenThreshold) {
        const prefix = getPrefix(Math.floor(magnitude / 3) - 1);
        const magnitudeUsed = magnitude - (magnitude % 3);
        const numUsed = num / Math.pow(10, magnitudeUsed);
        return `${numUsed.toFixed(3)}${prefix}`;
    }
    
    if (alwaysFixed) {
        formattedNum = num.toFixed(2);
    } else {
        const numStr = num.toString();
        const decimalIndex = numStr.indexOf('.');
        
        if (decimalIndex === -1 || numStr.length - decimalIndex - 1 <= 2) {
            formattedNum = num.toString();
        } else {
            formattedNum = num.toFixed(2);
        }
    }
    
    return formattedNum.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getPrefix(n) {
    const t1a = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"]
    const t1b = ["", "U", "D", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"]
    const t2 = ["", "Dc", "Vg", "Tg", "Qg", "Qig", "Sxg", "Spg", "Og", "Ng"]
    const t3 = ["", "Ce", "De", "Te", "Qe", "Qie", "Sxe", "Spe", "Oe", "Ne"]
    
    if(n < 10){
        return t1a[n]
    }
    if(n < 100){
        return t1b[n%10] + t2[Math.floor(n/10)]
    }
    if(n < 1000){
        return t1b[n%10] + t2[Math.floor(n/10)%10] + t3[Math.floor(n/100)]
    }
    return "OWO"
}

module.exports = { format };