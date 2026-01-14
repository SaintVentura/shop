// Script to generate Google Merchant Center product feed
const fs = require('fs');

const BRAND_WEBSITE = 'https://saintventura.co.za';

// Product data with full details
const products = [
    {
        id: 1,
        name: "The Saints Club Tee",
        price: 550,
        category: "tops",
        description: "Exclusive Saints Club tee featuring premium cotton construction and iconic Saint Ventura branding. A must-have for true streetwear enthusiasts.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["White"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/j0pgw2egryb9f0470f3p3/1-2.png?rlkey=xaw4k5w0yhwswfae3pi1n0g2r&st=vnlwftci&dl=1"],
        availableColors: [{ name: "White", image: "https://dl.dropboxusercontent.com/scl/fi/j0pgw2egryb9f0470f3p3/1-2.png?rlkey=xaw4k5w0yhwswfae3pi1n0g2r&st=vnlwftci&dl=1" }]
    },
    {
        id: 2,
        name: "SV Till I R.I.P Tee",
        price: 500,
        category: "tops",
        description: "Bold statement tee with the iconic 'SV Till I R.I.P' graphic. Made from premium cotton with a comfortable fit and striking design.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/6ribhwbytdqfqva6jgf3s/1-16.png?rlkey=s61uev3dxmsmo4coifrqtozge&st=z3y4nuri&dl=1"],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/6ribhwbytdqfqva6jgf3s/1-16.png?rlkey=s61uev3dxmsmo4coifrqtozge&st=z3y4nuri&dl=1" }]
    },
    {
        id: 3,
        name: "Visionaries by SV",
        price: 200,
        category: "accessories",
        description: "Premium sunglasses designed for the visionaries and trendsetters. Features sleek black frames with UV protection and the signature SV branding for those who see the world differently.",
        sizes: ["One Size Fits All"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/qs6id9xzrvfp8dctj2lqf/1-15.png?rlkey=shaa8t54va6ap95kulvvk1jee&st=tpwythhm&dl=1"],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/qs6id9xzrvfp8dctj2lqf/1-15.png?rlkey=shaa8t54va6ap95kulvvk1jee&st=tpwythhm&dl=1" }]
    },
    {
        id: 4,
        name: "SV Creators Hat",
        price: 200,
        category: "accessories",
        description: "Premium snapback designed for the creative minds and innovators. Features bold embroidered SV logo with adjustable snapback closure for the perfect fit on any creator's journey.",
        sizes: ["One Size Fits All"],
        colors: ["Red", "Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/16j1629tb9ces8c4vruvh/1-4.png?rlkey=myve0lk7x9zdn6xfen7mah640&st=d0j0b6nb&dl=1"],
        availableColors: [
            { name: "Red", image: "https://dl.dropboxusercontent.com/scl/fi/16j1629tb9ces8c4vruvh/1-4.png?rlkey=myve0lk7x9zdn6xfen7mah640&st=d0j0b6nb&dl=1" },
            { name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/5h9lftt1bidmqijpmpxll/1-3.png?rlkey=501zjd9pkgf9w5yhrparmm5rd&st=uhhf8qul&dl=1" }
        ]
    },
    {
        id: 5,
        name: "Hood* of The Saints",
        price: 400,
        category: "tops",
        description: "Premium oversized hoodie representing The Saints collective. Heavyweight cotton blend with dropped shoulders and kangaroo pocket.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Baby Blue", "Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/tv6xmtknl5e93s4q2rxvr/1-7.png?rlkey=6y8szp285r72rby6k6jkw8038&st=n6gbin36&dl=1"],
        availableColors: [
            { name: "Baby Blue", image: "https://dl.dropboxusercontent.com/scl/fi/tv6xmtknl5e93s4q2rxvr/1-7.png?rlkey=6y8szp285r72rby6k6jkw8038&st=n6gbin36&dl=1" },
            { name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/mtvek2orgliosk1e5w0zg/1-5.png?rlkey=akio0f1ps0tumeghs50q10blr&st=ktcib4de&dl=1" }
        ]
    },
    {
        id: 6,
        name: "SV Utility Shirt",
        price: 400,
        category: "tops",
        description: "Functional utility shirt with multiple pockets and durable construction. Perfect blend of style and practicality for the modern creator.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/tg8jpo7hxksb5fmiyivo7/1-9.png?rlkey=wlaat82bhy29xpcyuyme0b1mi&st=p7wbg6k7&dl=1"],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/tg8jpo7hxksb5fmiyivo7/1-9.png?rlkey=wlaat82bhy29xpcyuyme0b1mi&st=p7wbg6k7&dl=1" }]
    },
    {
        id: 7,
        name: "SV Cargo Pants",
        price: 300,
        category: "bottoms",
        description: "Premium cargo pants with multiple pockets and adjustable details. Essential streetwear piece combining functionality with Saint Ventura style.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/q82xmvf10v3bfth0yb9tb/1-17.png?rlkey=86y3k3tbqdqgs63h2gzs86d81&st=brqjs51u&dl=1"],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/q82xmvf10v3bfth0yb9tb/1-17.png?rlkey=86y3k3tbqdqgs63h2gzs86d81&st=brqjs51u&dl=1" }]
    },
    {
        id: 8,
        name: "Ventura Crop Tank",
        price: 300,
        category: "tops",
        description: "Cropped tank top perfect for layering or standalone wear. Available in multiple colorways to match your personal style.",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black", "Army Green", "White"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/j22zx7qt5efevtqmbki5a/1-10.png?rlkey=w1m9xosbjx5jiihn45l1o7hj7&st=9whfbavz&dl=1"],
        availableColors: [
            { name: "Army Green", image: "https://dl.dropboxusercontent.com/scl/fi/j22zx7qt5efevtqmbki5a/1-10.png?rlkey=w1m9xosbjx5jiihn45l1o7hj7&st=9whfbavz&dl=1" },
            { name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/mud785w0gso758kjl8d0y/1-6.PNG?rlkey=wj0x9hpnflobqndsak1drzpxt&st=bvmxst4j&dl=1" },
            { name: "White", image: "https://dl.dropboxusercontent.com/scl/fi/0izhvhpqgv7ym8o53dfk6/3-1.PNG?rlkey=34wr7bf7w9qr4aqcx8em9puv7&st=5xbyxbt1&dl=1" }
        ]
    },
    {
        id: 9,
        name: "Essential Beanie",
        price: 200,
        category: "accessories",
        description: "The ultimate essential for any streetwear wardrobe. This premium knit beanie features the iconic Saint Ventura logo and provides comfort and style for every season.",
        sizes: ["One Size Fits All"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/sw3imbzsqend0zigd3yww/1-13.png?rlkey=iolsj7x1ryqxxh2t4okvw46zp&st=nryoy8dl&dl=1"],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/sw3imbzsqend0zigd3yww/1-13.png?rlkey=iolsj7x1ryqxxh2t4okvw46zp&st=nryoy8dl&dl=1" }]
    },
    {
        id: 10,
        name: "Onyx Bracelet By SV",
        price: 60,
        category: "accessories",
        description: "Premium onyx bracelet featuring natural black stones. Handcrafted with Saint Ventura branding for the discerning streetwear enthusiast.",
        sizes: ["13cm", "14cm", "15cm", "16cm", "17cm", "18cm"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/xevb4s1aeggk0fjcwk85e/1-18.png?rlkey=vs9rk6nu79b5nwtdxme114crx&st=6fn852el&dl=1"],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/xevb4s1aeggk0fjcwk85e/1-18.png?rlkey=vs9rk6nu79b5nwtdxme114crx&st=6fn852el&dl=1" }]
    }
];

// Function to escape TSV values (replace tabs and newlines)
function escapeTSV(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/\t/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
}

// Generate product feed rows
const rows = [];

// Header row
rows.push([
    'id',
    'title',
    'description',
    'link',
    'image_link',
    'availability',
    'price',
    'condition',
    'brand',
    'google_product_category',
    'product_type'
].join('\t'));

// Generate rows for each product variant
products.forEach(product => {
    product.sizes.forEach(size => {
        product.availableColors.forEach(color => {
            const variantId = `${product.id}-${size}-${color.name}`;
            const title = `${product.name} - ${color.name} - ${size}`;
            const price = `${product.price.toFixed(2)} ZAR`;
            const link = `${BRAND_WEBSITE}/index.html`;
            const imageLink = color.image || product.images[0];
            
            // Map category to Google product category
            let googleCategory = '';
            if (product.category === 'tops') {
                googleCategory = 'Apparel & Accessories > Clothing > Shirts & Tops';
            } else if (product.category === 'bottoms') {
                googleCategory = 'Apparel & Accessories > Clothing > Pants';
            } else if (product.category === 'accessories') {
                googleCategory = 'Apparel & Accessories > Clothing Accessories';
            }
            
            rows.push([
                escapeTSV(variantId),
                escapeTSV(title),
                escapeTSV(product.description),
                escapeTSV(link),
                escapeTSV(imageLink),
                'in stock',
                price,
                'new',
                'Saint Ventura',
                escapeTSV(googleCategory),
                escapeTSV(product.category)
            ].join('\t'));
        });
    });
});

// Write to file
const output = rows.join('\n');
fs.writeFileSync('merchant_center_products.tsv', output, 'utf8');

console.log('✅ Google Merchant Center product feed generated successfully!');
console.log(`📄 File: merchant_center_products.tsv`);
console.log(`📊 Total product variants: ${rows.length - 1}`);

