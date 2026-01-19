// Script to convert TSV file to CSV format for Google Sheets
const fs = require('fs');

// Read the TSV file
const tsvContent = fs.readFileSync('Google Merchant Centre feed – Products source - Sheet1.tsv', 'utf8');

// Split into lines
const lines = tsvContent.split('\n');

// Convert each line from tab-separated to comma-separated
// Need to handle fields that might contain commas by wrapping them in quotes
function escapeCSVField(field) {
    if (field === null || field === undefined || field === '') {
        return '';
    }
    
    const str = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    
    return str;
}

const csvLines = lines.map(line => {
    // Split by tab
    const fields = line.split('\t');
    
    // Escape each field and join with commas
    return fields.map(escapeCSVField).join(',');
});

// Join lines back together
const csvContent = csvLines.join('\n');

// Write to CSV file
fs.writeFileSync('Google Merchant Centre feed – Products source - Sheet1.csv', csvContent, 'utf8');

console.log('✅ TSV file converted to CSV successfully!');
console.log(`📄 File: Google Merchant Centre feed – Products source - Sheet1.csv`);
console.log(`📊 Total rows: ${csvLines.length}`);


