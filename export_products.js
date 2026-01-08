// Product export script
// Run with: node export_products.js

const fs = require('fs');

// Products array (excluding test product with id: 11)
const products = [
    {
        id: 1,
        name: "The Saints Club Tee",
        price: 550,
        category: "tops",
        description: "Exclusive Saints Club tee featuring premium cotton construction and iconic Saint Ventura branding. A must-have for true streetwear enthusiasts.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["White"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/j0pgw2egryb9f0470f3p3/1-2.png?rlkey=xaw4k5w0yhwswfae3pi1n0g2r&st=vnlwftci&dl=1"]
    },
    {
        id: 2,
        name: "SV Till I R.I.P Tee",
        price: 500,
        category: "tops",
        description: "Bold statement tee with the iconic 'SV Till I R.I.P' graphic. Made from premium cotton with a comfortable fit and striking design.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/6ribhwbytdqfqva6jgf3s/1-16.png?rlkey=s61uev3dxmsmo4coifrqtozge&st=z3y4nuri&dl=1"]
    },
    {
        id: 3,
        name: "Visionaries by SV",
        price: 200,
        category: "accessories",
        description: "Premium sunglasses designed for the visionaries and trendsetters. Features sleek black frames with UV protection and the signature SV branding for those who see the world differently.",
        sizes: ["One Size Fits All"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/qs6id9xzrvfp8dctj2lqf/1-15.png?rlkey=shaa8t54va6ap95kulvvk1jee&st=tpwythhm&dl=1"]
    },
    {
        id: 4,
        name: "SV Creators Hat",
        price: 200,
        category: "accessories",
        description: "Premium snapback designed for the creative minds and innovators. Features bold embroidered SV logo with adjustable snapback closure for the perfect fit on any creator's journey.",
        sizes: ["One Size Fits All"],
        colors: ["Red", "Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/16j1629tb9ces8c4vruvh/1-4.png?rlkey=myve0lk7x9zdn6xfen7mah640&st=d0j0b6nb&dl=1"]
    },
    {
        id: 5,
        name: "Hood* of The Saints",
        price: 400,
        category: "tops",
        description: "Premium oversized hoodie representing The Saints collective. Heavyweight cotton blend with dropped shoulders and kangaroo pocket.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Baby Blue", "Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/tv6xmtknl5e93s4q2rxvr/1-7.png?rlkey=6y8szp285r72rby6k6jkw8038&st=n6gbin36&dl=1"]
    },
    {
        id: 6,
        name: "SV Utility Shirt",
        price: 400,
        category: "tops",
        description: "Functional utility shirt with multiple pockets and durable construction. Perfect blend of style and practicality for the modern creator.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/tg8jpo7hxksb5fmiyivo7/1-9.png?rlkey=wlaat82bhy29xpcyuyme0b1mi&st=p7wbg6k7&dl=1"]
    },
    {
        id: 7,
        name: "SV Cargo Pants",
        price: 300,
        category: "bottoms",
        description: "Premium cargo pants with multiple pockets and adjustable details. Essential streetwear piece combining functionality with Saint Ventura style.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/q82xmvf10v3bfth0yb9tb/1-17.png?rlkey=86y3k3tbqdqgs63h2gzs86d81&st=brqjs51u&dl=1"]
    },
    {
        id: 8,
        name: "Ventura Crop Tank",
        price: 300,
        category: "tops",
        description: "Cropped tank top perfect for layering or standalone wear. Available in multiple colorways to match your personal style.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black", "Army Green", "White"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/j22zx7qt5efevtqmbki5a/1-10.png?rlkey=w1m9xosbjx5jiihn45l1o7hj7&st=9whfbavz&dl=1"]
    },
    {
        id: 9,
        name: "Essential Beanie",
        price: 200,
        category: "accessories",
        description: "The ultimate essential for any streetwear wardrobe. This premium knit beanie features the iconic Saint Ventura logo and provides comfort and style for every season.",
        sizes: ["One Size Fits All"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/sw3imbzsqend0zigd3yww/1-13.png?rlkey=iolsj7x1ryqxxh2t4okvw46zp&st=nryoy8dl&dl=1"]
    },
    {
        id: 10,
        name: "Onyx Bracelet By SV",
        price: 60,
        category: "accessories",
        description: "Premium onyx bracelet featuring natural black stones. Handcrafted with Saint Ventura branding for the discerning streetwear enthusiast.",
        sizes: ["13cm", "14cm", "15cm", "16cm", "17cm", "18cm"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/xevb4s1aeggk0fjcwk85e/1-18.png?rlkey=vs9rk6nu79b5nwtdxme114crx&st=6fn852el&dl=1"]
    }
];

// Helper function to escape CSV fields
function escapeCSV(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Map category to Yoco format
function mapCategory(category) {
    const mapping = {
        'tops': 'Clothing',
        'bottoms': 'Clothing',
        'accessories': 'Accessories'
    };
    return mapping[category] || category;
}

// Generate SKU
function generateSKU(productId, size = '', color = '') {
    const base = `SV${String(productId).padStart(3, '0')}`;
    const sizeCode = size ? size.substring(0, 2).toUpperCase() : '';
    const colorCode = color ? color.substring(0, 2).toUpperCase() : '';
    return base + sizeCode + colorCode;
}

// Generate CSV rows
const csvRows = [];
csvRows.push('Product ID,Product Name,Description,Default Price,Brand,Category,SKU,Default Cost Price,Ask For Quantity,Default Quantity,Quantity Units,Ask For Price,VAT Enabled,Variant Price,Variant Enabled,Attribute 1,Value 1,Attribute 2,Value 2,Attribute 3,Value 3,Image URL,Barcode,Track Stock');

products.forEach(product => {
    const productId = `sv${String(product.id).padStart(3, '0')}`;
    const productName = product.name;
    const description = product.description || '';
    const defaultPrice = product.price.toFixed(2);
    const brand = 'Saint Ventura';
    const category = mapCategory(product.category);
    const imageUrl = product.images && product.images.length > 0 ? product.images[0] : '';
    
    const sizes = product.sizes || [];
    const colors = product.colors || [];
    
    // If product has variants (multiple sizes or colors)
    const hasVariants = sizes.length > 1 || colors.length > 1;
    
    if (hasVariants) {
        // Create a row for each size/color combination
        sizes.forEach(size => {
            colors.forEach(color => {
                const sku = generateSKU(product.id, size, color);
                const row = [
                    productId,
                    productName,
                    description,
                    defaultPrice,
                    brand,
                    category,
                    sku,
                    '', // Default Cost Price
                    '', // Ask For Quantity
                    '', // Default Quantity
                    '', // Quantity Units
                    '', // Ask For Price
                    'Yes', // VAT Enabled
                    '', // Variant Price (same as default)
                    'Yes', // Variant Enabled
                    'Size', // Attribute 1
                    size, // Value 1
                    'Color', // Attribute 2
                    color, // Value 2
                    '', // Attribute 3
                    '', // Value 3
                    imageUrl,
                    '', // Barcode
                    '' // Track Stock
                ];
                csvRows.push(row.map(escapeCSV).join(','));
            });
        });
    } else {
        // Single variant product
        const size = sizes.length > 0 ? sizes[0] : '';
        const color = colors.length > 0 ? colors[0] : '';
        const sku = generateSKU(product.id, size, color);
        
        const row = [
            productId,
            productName,
            description,
            defaultPrice,
            brand,
            category,
            sku,
            '', // Default Cost Price
            '', // Ask For Quantity
            '', // Default Quantity
            '', // Quantity Units
            '', // Ask For Price
            'Yes', // VAT Enabled
            '', // Variant Price
            'Yes', // Variant Enabled
            size ? 'Size' : '', // Attribute 1
            size, // Value 1
            color ? 'Color' : '', // Attribute 2
            color, // Value 2
            '', // Attribute 3
            '', // Value 3
            imageUrl,
            '', // Barcode
            '' // Track Stock
        ];
        csvRows.push(row.map(escapeCSV).join(','));
    }
});

// Write to CSV file
const csvContent = csvRows.join('\n');
const filename = 'Saint_Ventura_Products_Export.csv';

fs.writeFileSync(filename, csvContent, 'utf8');
console.log(`✅ CSV file created: ${filename}`);
console.log(`📊 Total rows: ${csvRows.length - 1} (excluding header)`);
console.log(`📦 Products exported: ${products.length}`);


