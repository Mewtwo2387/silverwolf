// When alwaysFixed is false, return up to 2 d.p. Used in credits.
// format(1234) => "1,234"
// format(1234.1) => "1,234.1"
// format(1234.1234) => "1,234.12"
// When alwaysFixed is true, always return 2 d.p. Used in multipliers and percentages.
// format(1234, true) => "1,234.00"
// format(1234.1, true) => "1,234.10"
// format(1234.1234, true) => "1,234.12"
function format(num, alwaysFixed = false) {
    let formattedNum;
    
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

module.exports = { format };