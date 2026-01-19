// Script to generate complete Google Merchant Center product feed with all fields
const fs = require('fs');

const BRAND_WEBSITE = 'https://saintventura.co.za';
const BRAND_NAME = 'Saint Ventura';

// Product data with full details including material, pattern, etc.
const products = [
    {
        id: 1,
        name: "The Saints Club Tee",
        price: 550,
        category: "tops",
        description: "Exclusive Saints Club tee featuring premium cotton construction and iconic Saint Ventura branding. A must-have for true streetwear enthusiasts.",
        details: ["100% Premium Cotton", "Screen-printed graphics", "Oversized fit", "Dropped shoulders"],
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["White"],
        images: [
            "https://dl.dropboxusercontent.com/scl/fi/j0pgw2egryb9f0470f3p3/1-2.png?rlkey=xaw4k5w0yhwswfae3pi1n0g2r&st=vnlwftci&dl=1",
            "https://dl.dropboxusercontent.com/scl/fi/zz0b97q19mm561t44ksj2/1-1.png?rlkey=kinak1p66dy82z8qgah2av2jd&st=vt0bzo6m&dl=1"
        ],
        availableColors: [{ name: "White", image: "https://dl.dropboxusercontent.com/scl/fi/j0pgw2egryb9f0470f3p3/1-2.png?rlkey=xaw4k5w0yhwswfae3pi1n0g2r&st=vnlwftci&dl=1" }],
        material: "100% Premium Cotton",
        pattern: "Graphic Print"
    },
    {
        id: 2,
        name: "SV Till I R.I.P Tee",
        price: 500,
        category: "tops",
        description: "Bold statement tee with the iconic 'SV Till I R.I.P' graphic. Made from premium cotton with a comfortable fit and striking design.",
        details: ["100% Premium Cotton", "Bold graphic print", "Oversized fit", "Dropped shoulders"],
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black"],
        images: [
            "https://dl.dropboxusercontent.com/scl/fi/6ribhwbytdqfqva6jgf3s/1-16.png?rlkey=s61uev3dxmsmo4coifrqtozge&st=z3y4nuri&dl=1",
            "https://dl.dropboxusercontent.com/scl/fi/2ma5ldkyiam6dm947eg8f/1-14.png?rlkey=0xb8p0qyps0st9t4z3ez47fm9&st=y2q4jni7&dl=1"
        ],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/6ribhwbytdqfqva6jgf3s/1-16.png?rlkey=s61uev3dxmsmo4coifrqtozge&st=z3y4nuri&dl=1" }],
        material: "100% Premium Cotton",
        pattern: "Graphic Print"
    },
    {
        id: 3,
        name: "Visionaries by SV",
        price: 200,
        category: "accessories",
        description: "Premium sunglasses designed for the visionaries and trendsetters. Features sleek black frames with UV protection and the signature SV branding for those who see the world differently.",
        details: ["Premium acetate frame", "100% UV400 protection", "Polarized lenses", "SV logo on temples", "Scratch-resistant coating", "Includes protective case"],
        sizes: ["One Size Fits All"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/qs6id9xzrvfp8dctj2lqf/1-15.png?rlkey=shaa8t54va6ap95kulvvk1jee&st=tpwythhm&dl=1"],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/qs6id9xzrvfp8dctj2lqf/1-15.png?rlkey=shaa8t54va6ap95kulvvk1jee&st=tpwythhm&dl=1" }],
        material: "Acetate",
        pattern: "Solid"
    },
    {
        id: 4,
        name: "SV Creators Hat",
        price: 200,
        category: "accessories",
        description: "Premium snapback designed for the creative minds and innovators. Features bold embroidered SV logo with adjustable snapback closure for the perfect fit on any creator's journey.",
        details: ["Premium cotton twill construction", "3D embroidered SV logo", "Adjustable snapback closure", "Structured 6-panel crown", "Interior moisture-wicking sweatband"],
        sizes: ["One Size Fits All"],
        colors: ["Red", "Black"],
        images: [
            "https://dl.dropboxusercontent.com/scl/fi/16j1629tb9ces8c4vruvh/1-4.png?rlkey=myve0lk7x9zdn6xfen7mah640&st=d0j0b6nb&dl=1",
            "https://dl.dropboxusercontent.com/scl/fi/5h9lftt1bidmqijpmpxll/1-3.png?rlkey=501zjd9pkgf9w5yhrparmm5rd&st=uhhf8qul&dl=1"
        ],
        availableColors: [
            { name: "Red", image: "https://dl.dropboxusercontent.com/scl/fi/16j1629tb9ces8c4vruvh/1-4.png?rlkey=myve0lk7x9zdn6xfen7mah640&st=d0j0b6nb&dl=1" },
            { name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/5h9lftt1bidmqijpmpxll/1-3.png?rlkey=501zjd9pkgf9w5yhrparmm5rd&st=uhhf8qul&dl=1" }
        ],
        material: "Premium Cotton Twill",
        pattern: "Solid"
    },
    {
        id: 5,
        name: "Hood* of The Saints",
        price: 400,
        category: "tops",
        description: "Premium oversized hoodie representing The Saints collective. Heavyweight cotton blend with dropped shoulders and kangaroo pocket.",
        details: ["80% Cotton, 20% Polyester", "Heavyweight 400gsm fabric", "Oversized fit", "Kangaroo pocket"],
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Baby Blue", "Black"],
        images: [
            "https://dl.dropboxusercontent.com/scl/fi/tv6xmtknl5e93s4q2rxvr/1-7.png?rlkey=6y8szp285r72rby6k6jkw8038&st=n6gbin36&dl=1",
            "https://dl.dropboxusercontent.com/scl/fi/mtvek2orgliosk1e5w0zg/1-5.png?rlkey=akio0f1ps0tumeghs50q10blr&st=ktcib4de&dl=1"
        ],
        availableColors: [
            { name: "Baby Blue", image: "https://dl.dropboxusercontent.com/scl/fi/tv6xmtknl5e93s4q2rxvr/1-7.png?rlkey=6y8szp285r72rby6k6jkw8038&st=n6gbin36&dl=1" },
            { name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/mtvek2orgliosk1e5w0zg/1-5.png?rlkey=akio0f1ps0tumeghs50q10blr&st=ktcib4de&dl=1" }
        ],
        material: "80% Cotton, 20% Polyester",
        pattern: "Solid"
    },
    {
        id: 6,
        name: "SV Utility Shirt",
        price: 400,
        category: "tops",
        description: "Functional utility shirt with multiple pockets and durable construction. Perfect blend of style and practicality for the modern creator.",
        details: ["100% Cotton Twill", "Multiple utility pockets", "Button-up closure", "Regular fit"],
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black"],
        images: [
            "https://dl.dropboxusercontent.com/scl/fi/tg8jpo7hxksb5fmiyivo7/1-9.png?rlkey=wlaat82bhy29xpcyuyme0b1mi&st=p7wbg6k7&dl=1",
            "https://dl.dropboxusercontent.com/scl/fi/lkvuuntf1q627q7lq018n/1-8.png?rlkey=86rhveankf3zbagwb2hsqxze8&st=2jswyme5&dl=1"
        ],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/tg8jpo7hxksb5fmiyivo7/1-9.png?rlkey=wlaat82bhy29xpcyuyme0b1mi&st=p7wbg6k7&dl=1" }],
        material: "100% Cotton Twill",
        pattern: "Solid"
    },
    {
        id: 7,
        name: "SV Cargo Pants",
        price: 300,
        category: "bottoms",
        description: "Premium cargo pants with multiple pockets and adjustable details. Essential streetwear piece combining functionality with Saint Ventura style.",
        details: ["100% Cotton Twill", "Multiple cargo pockets", "Adjustable waist", "Tapered fit"],
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black"],
        images: [
            "https://dl.dropboxusercontent.com/scl/fi/q82xmvf10v3bfth0yb9tb/1-17.png?rlkey=86y3k3tbqdqgs63h2gzs86d81&st=brqjs51u&dl=1",
            "https://dl.dropboxusercontent.com/scl/fi/xocwsz4bcod4rop8mscs9/1-19.png?rlkey=n1zrg171gixabaff9cxftlmg7&st=jiuthcov&dl=1"
        ],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/q82xmvf10v3bfth0yb9tb/1-17.png?rlkey=86y3k3tbqdqgs63h2gzs86d81&st=brqjs51u&dl=1" }],
        material: "100% Cotton Twill",
        pattern: "Solid"
    },
    {
        id: 8,
        name: "Ventura Crop Tank",
        price: 300,
        category: "tops",
        description: "Cropped tank top perfect for layering or standalone wear. Available in multiple colorways to match your personal style.",
        details: ["100% Cotton", "Cropped fit", "Sleeveless design", "Soft hand feel"],
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black", "Army Green", "White"],
        images: [
            "https://dl.dropboxusercontent.com/scl/fi/j22zx7qt5efevtqmbki5a/1-10.png?rlkey=w1m9xosbjx5jiihn45l1o7hj7&st=9whfbavz&dl=1",
            "https://dl.dropboxusercontent.com/scl/fi/mud785w0gso758kjl8d0y/1-6.PNG?rlkey=wj0x9hpnflobqndsak1drzpxt&st=bvmxst4j&dl=1",
            "https://dl.dropboxusercontent.com/scl/fi/0izhvhpqgv7ym8o53dfk6/3-1.PNG?rlkey=34wr7bf7w9qr4aqcx8em9puv7&st=5xbyxbt1&dl=1"
        ],
        availableColors: [
            { name: "Army Green", image: "https://dl.dropboxusercontent.com/scl/fi/j22zx7qt5efevtqmbki5a/1-10.png?rlkey=w1m9xosbjx5jiihn45l1o7hj7&st=9whfbavz&dl=1" },
            { name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/mud785w0gso758kjl8d0y/1-6.PNG?rlkey=wj0x9hpnflobqndsak1drzpxt&st=bvmxst4j&dl=1" },
            { name: "White", image: "https://dl.dropboxusercontent.com/scl/fi/0izhvhpqgv7ym8o53dfk6/3-1.PNG?rlkey=34wr7bf7w9qr4aqcx8em9puv7&st=5xbyxbt1&dl=1" }
        ],
        material: "100% Cotton",
        pattern: "Solid"
    },
    {
        id: 9,
        name: "Essential Beanie",
        price: 200,
        category: "accessories",
        description: "The ultimate essential for any streetwear wardrobe. This premium knit beanie features the iconic Saint Ventura logo and provides comfort and style for every season.",
        details: ["100% Premium acrylic knit", "Embroidered SV logo", "Ribbed cuff construction", "Soft interior lining", "Stretchy comfortable fit", "Machine washable"],
        sizes: ["One Size Fits All"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/sw3imbzsqend0zigd3yww/1-13.png?rlkey=iolsj7x1ryqxxh2t4okvw46zp&st=nryoy8dl&dl=1"],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/sw3imbzsqend0zigd3yww/1-13.png?rlkey=iolsj7x1ryqxxh2t4okvw46zp&st=nryoy8dl&dl=1" }],
        material: "100% Premium Acrylic Knit",
        pattern: "Solid"
    },
    {
        id: 10,
        name: "Onyx Bracelet By SV",
        price: 60,
        category: "accessories",
        description: "Premium onyx bracelet featuring natural black stones. Handcrafted with Saint Ventura branding for the discerning streetwear enthusiast.",
        details: ["Natural onyx stones", "Elastic cord", "SV charm detail", "Handcrafted"],
        sizes: ["13cm", "14cm", "15cm", "16cm", "17cm", "18cm"],
        colors: ["Black"],
        images: ["https://dl.dropboxusercontent.com/scl/fi/xevb4s1aeggk0fjcwk85e/1-18.png?rlkey=vs9rk6nu79b5nwtdxme114crx&st=6fn852el&dl=1"],
        availableColors: [{ name: "Black", image: "https://dl.dropboxusercontent.com/scl/fi/xevb4s1aeggk0fjcwk85e/1-18.png?rlkey=vs9rk6nu79b5nwtdxme114crx&st=6fn852el&dl=1" }],
        material: "Natural Onyx Stones",
        pattern: "Solid"
    }
];

// Function to escape TSV values
function escapeTSV(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(value)
        .replace(/\t/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
}

// Function to get product highlights
function getProductHighlights(product) {
    if (!product.details || product.details.length === 0) return '';
    return product.details.slice(0, 3).map(d => `'${d}'`).join(', ');
}

// Function to get product details in format: section:attribute:value
function getProductDetails(product) {
    if (!product.details || product.details.length === 0) return '';
    const details = [];
    product.details.forEach(detail => {
        if (detail.includes('%')) {
            details.push(`Material:Composition:${detail}`);
        } else if (detail.toLowerCase().includes('cotton') || detail.toLowerCase().includes('polyester') || detail.toLowerCase().includes('acrylic')) {
            details.push(`Material:Type:${detail}`);
        } else {
            details.push(`Features:Detail:${detail}`);
        }
    });
    return details.join(', ');
}

// Function to get additional images
function getAdditionalImages(product, mainImage) {
    if (!product.images || product.images.length <= 1) return '';
    return product.images.filter(img => img !== mainImage).join(',');
}

// Generate product feed rows
const rows = [];

// Header row (keep the original header)
rows.push([
    'id',
    'title',
    'description',
    'availability',
    'availability date',
    'expiration date',
    'link',
    'mobile link',
    'image link',
    'price',
    'sale price',
    'sale price effective date',
    'identifier exists',
    'gtin',
    'mpn',
    'brand',
    'product highlight',
    'product detail',
    'additional image link',
    'condition',
    'adult',
    'color',
    'size',
    'size type',
    'size system',
    'gender',
    'material',
    'pattern',
    'age group',
    'multipack',
    'is bundle',
    'unit pricing measure',
    'unit pricing base measure',
    'energy efficiency class',
    'min energy efficiency class',
    'min energy efficiency class',
    'item group id',
    'sell on google quantity'
].join('\t'));

// Generate rows for each product variant
products.forEach(product => {
    const isClothing = product.category === 'tops' || product.category === 'bottoms';
    const isAccessory = product.category === 'accessories';
    
    product.sizes.forEach(size => {
        product.availableColors.forEach(color => {
            const variantId = `${product.id}-${size}-${color.name}`;
            const title = `${product.name} - ${color.name}${size !== 'One Size Fits All' ? ` - ${size}` : ''}`;
            const price = `${product.price.toFixed(2)} ZAR`;
            const link = `${BRAND_WEBSITE}/index.html`;
            const imageLink = color.image || product.images[0];
            const additionalImages = getAdditionalImages(product, imageLink);
            const highlights = getProductHighlights(product);
            const details = getProductDetails(product);
            
            // Determine gender based on product
            let gender = 'unisex';
            if (isClothing) {
                gender = 'unisex'; // Most streetwear is unisex
            }
            
            // Determine age group
            let ageGroup = 'adult';
            if (isClothing || isAccessory) {
                ageGroup = 'adult';
            }
            
            // Item group ID for variants (same product, different sizes/colors)
            const itemGroupId = String(product.id);
            
            const row = [
                escapeTSV(variantId),                    // id
                escapeTSV(title),                        // title
                escapeTSV(product.description),          // description
                'in_stock',                              // availability
                '',                                      // availability date
                '',                                      // expiration date
                escapeTSV(link),                         // link
                '',                                      // mobile link
                escapeTSV(imageLink),                     // image link
                price,                                   // price
                '',                                      // sale price
                '',                                      // sale price effective date
                'no',                                    // identifier exists
                '',                                      // gtin
                '',                                      // mpn
                BRAND_NAME,                              // brand
                escapeTSV(highlights),                   // product highlight
                escapeTSV(details),                      // product detail
                escapeTSV(additionalImages),             // additional image link
                'new',                                   // condition
                'no',                                    // adult
                isClothing || isAccessory ? escapeTSV(color.name) : '', // color
                isClothing || isAccessory ? escapeTSV(size) : '', // size
                '',                                      // size type
                '',                                      // size system
                isClothing ? gender : '',                 // gender
                isClothing || isAccessory ? escapeTSV(product.material) : '', // material
                isClothing || isAccessory ? escapeTSV(product.pattern) : '', // pattern
                isClothing || isAccessory ? ageGroup : '', // age group
                '',                                      // multipack
                '',                                      // is bundle
                '',                                      // unit pricing measure
                '',                                      // unit pricing base measure
                '',                                      // energy efficiency class
                '',                                      // min energy efficiency class
                '',                                      // min energy efficiency class (duplicate)
                isClothing && product.sizes.length > 1 ? escapeTSV(itemGroupId) : '', // item group id
                ''                                       // sell on google quantity
            ];
            
            rows.push(row.join('\t'));
        });
    });
});

// Write to file
const output = rows.join('\n');
fs.writeFileSync('Google Merchant Centre feed – Products source - Sheet1.tsv', output, 'utf8');

console.log('✅ Complete Google Merchant Center product feed generated successfully!');
console.log(`📄 File: Google Merchant Centre feed – Products source - Sheet1.tsv`);
console.log(`📊 Total product variants: ${rows.length - 1}`);

