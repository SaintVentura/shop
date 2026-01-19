// Script to convert CSV file to XLSX format
const XLSX = require('xlsx');
const fs = require('fs');

// Read the CSV file
const csvContent = fs.readFileSync('Google Merchant Centre feed – Products source - Sheet1.csv', 'utf8');

// Parse CSV content
const lines = csvContent.split('\n').filter(line => line.trim() !== '');
const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));

// Parse CSV rows (handling quoted fields with commas)
function parseCSVLine(line) {
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                currentField += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            fields.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    
    // Add last field
    fields.push(currentField);
    
    return fields;
}

// Parse all rows
const rows = [];
for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    rows.push(fields);
}

// Create worksheet data
const worksheetData = [headers, ...rows];

// Create workbook and worksheet
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

// Write to XLSX file
XLSX.writeFile(workbook, 'Google Merchant Centre feed – Products source - Sheet1.xlsx');

console.log('✅ CSV file converted to XLSX successfully!');
console.log(`📄 File: Google Merchant Centre feed – Products source - Sheet1.xlsx`);
console.log(`📊 Total rows: ${rows.length + 1} (including header)`);


