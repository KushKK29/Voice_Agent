// Mock sellers. The `metrics` table for S1001 is from the assignment; everything else is
// SAMPLE data added by us and listed in `assumptions` (shown in the UI, said aloud by the bot).
// Deliberately absent: cancellation reasons, payments, competitor prices, ad spend.
// Deterministic tail of lower-selling products so each catalogue looks real. Sample data.
// All in stock, so the out-of-stock figures that drive the diagnosis stay as defined.
export const tail = (prefix, names, start, base, price) =>
  names.map((name, i) => {
    const last = Math.max(2, Math.round(base - i * 0.4));
    return { sku: `${prefix}-${String(start + i).padStart(2, '0')}`, name, last_month_orders: last, this_month_orders: Math.max(1, last - (i % 3)), price: price + (i % 7) * 20, stock: 20 + ((i * 17) % 90), return_rate: 0.02 + (i % 5) * 0.01 };
  });
const S1001_TAIL = ['Plastic Container Set', 'Rolling Pin', 'Chopping Board', 'Peeler Set', 'Ladle Set', 'Mixing Bowl Set', 'Kitchen Scissors', 'Grater', 'Masher', 'Pizza Cutter', 'Egg Slicer', 'Oil Dispenser', 'Salt Pepper Shaker', 'Measuring Cups', 'Cake Mould', 'Idli Maker', 'Pressure Cooker 3L', 'Kadhai Steel', 'Tawa Non-stick', 'Milk Pan', 'Dinner Plate Set', 'Water Jug', 'Serving Tray', 'Bottle Brush', 'Dish Rack', 'Kitchen Towel Pack', 'Apron', 'Oven Gloves', 'Tea Strainer', 'Coffee Mug Set', 'Soup Bowl Set', 'Napkin Holder', 'Steel Glass Set', 'Stainless Spoon Set', 'Lunch Bag', 'Snack Box', 'Ice Cube Tray', 'Funnel Set', 'Colander', 'Jar Set 6pc', 'Pickle Jar', 'Atta Container', 'Thermos Flask', 'Sandwich Maker', 'Chapati Box', 'Masala Box', 'Tongs', 'Whisk', 'Garlic Press', 'Can Opener'];
const S1002_TAIL = ['Anarkali Kurti', 'Palazzo Pants', 'Chanderi Dupatta', 'Cotton Salwar Suit', 'Block Print Saree', 'Straight Kurta', 'Leggings Pack', 'Silk Blend Saree', 'Embroidered Kurti', 'Phulkari Dupatta', 'Lehenga Choli', 'Churidar', 'Short Kurti', 'Patiala Salwar', 'Cotton Stole', 'Georgette Saree', 'Kurti with Pants', 'Ikat Dupatta', 'Printed Palazzo', 'Sharara Set', 'A-line Kurti', 'Bandhani Dupatta', 'Linen Kurta', 'Rayon Kurti', 'Mirror Work Dupatta', 'Casual Saree', 'Straight Pants', 'Chikankari Kurti', 'Jacket Kurti', 'Cotton Nighty', 'Festive Kurta Set', 'Pashmina Shawl', 'Dhoti Pants', 'Cape Kurti', 'Tunic Top', 'Gota Dupatta', 'Banarasi Saree', 'Kota Doria Saree', 'Slit Kurti', 'Pleated Palazzo', 'Jaipuri Kurti', 'Net Dupatta'];

const S1003_TAIL = ['Matte Lipstick', 'Kajal Pencil', 'Face Wash 100ml', 'Sunscreen SPF50', 'Hair Oil 200ml', 'Shampoo 340ml', 'Conditioner', 'Face Serum', 'Moisturiser 100g', 'Lip Balm', 'Nail Polish Set', 'Compact Powder', 'Foundation', 'Eyeliner', 'Mascara', 'Body Lotion', 'Hand Cream', 'Face Mask Sheet Pack', 'Makeup Brush Set', 'Beauty Blender', 'Hair Clips Pack', 'Comb Set', 'Hair Dryer', 'Straightener', 'Perfume 50ml', 'Deodorant', 'Talc Powder', 'Rose Water', 'Aloe Vera Gel', 'Scrub 100g'];
const S1004_TAIL = ['Phone Case', 'Tempered Glass', 'USB-C Cable', 'Lightning Cable', 'Fast Charger 20W', 'Car Charger', 'Power Bank 10000mAh', 'Bluetooth Earbuds', 'Wired Earphones', 'Phone Stand', 'Selfie Stick', 'Ring Light', 'Memory Card 64GB', 'OTG Adapter', 'Laptop Sleeve', 'Mouse Pad', 'Wireless Mouse', 'Keyboard Cover', 'Screen Cleaner Kit', 'Cable Organiser', 'Smart Watch Strap', 'Pop Socket', 'Aux Cable', 'Mobile Holder Car', 'HDMI Cable', 'WiFi Dongle', 'Mini Speaker', 'LED Bulb Smart', 'Extension Board', 'Card Reader'];
const S1005_TAIL = ['Steel Water Bottle', 'Yoga Mat', 'Dumbbell Pair 2kg', 'Skipping Rope', 'Resistance Band', 'Gym Gloves', 'Sports Cap', 'Backpack 25L', 'Duffel Bag', 'Sipper Bottle', 'Running Socks', 'Wrist Band', 'Hand Gripper', 'Ab Roller', 'Foam Roller', 'Shaker Bottle', 'Knee Support', 'Cricket Ball', 'Badminton Racket', 'Shuttle Pack', 'Football', 'Swim Goggles', 'Towel Sports', 'Gym Bag', 'Headband', 'Tripod Mini', 'Cycling Gloves', 'Water Bag', 'Trekking Pole', 'Rain Cover'];

export const SELLERS = [
  {
    _id: 'S1001',
    name: 'Ramesh Home Essentials',
    owner: 'Ramesh',
    city: 'Jaipur',
    category: 'Home & Kitchen',
    active_skus: 60,
    metrics: {
      last_month: { sales: 200000, orders: 400, cancel_rate: 0.08, asp: 500, oos: 5 },
      this_month: { sales: 135000, orders: 270, cancel_rate: 0.14, asp: 500, oos: 18 },
    },
    // sample: 60 products (top 10 by hand, 50 generated). The 18 out-of-stock count is from the brief; only the top 5 are itemised
    products: [
      { sku: 'LB-01', name: 'Steel Lunch Box Set', last_month_orders: 28, this_month_orders: 3, price: 499, stock: 0, return_rate: 0.03 },
      { sku: 'WB-02', name: 'Insulated Water Bottle 1L', last_month_orders: 24, this_month_orders: 3, price: 450, stock: 0, return_rate: 0.04 },
      { sku: 'KN-03', name: 'Kitchen Knife Set', last_month_orders: 19, this_month_orders: 3, price: 550, stock: 0, return_rate: 0.09 },
      { sku: 'CK-04', name: 'Non-stick Cookware Combo', last_month_orders: 17, this_month_orders: 3, price: 650, stock: 0, return_rate: 0.05 },
      { sku: 'SP-05', name: 'Spice Rack Organiser', last_month_orders: 14, this_month_orders: 3, price: 399, stock: 0, return_rate: 0.02 },
      { sku: 'TF-06', name: 'Tiffin Carrier', last_month_orders: 22, this_month_orders: 21, price: 520, stock: 85, return_rate: 0.04 },
      { sku: 'CT-07', name: 'Cutlery Set', last_month_orders: 18, this_month_orders: 17, price: 480, stock: 60, return_rate: 0.03 },
      { sku: 'SB-08', name: 'Storage Box Set', last_month_orders: 16, this_month_orders: 15, price: 510, stock: 40, return_rate: 0.05 },
      { sku: 'HP-09', name: 'Hot Pot Casserole', last_month_orders: 15, this_month_orders: 13, price: 560, stock: 30, return_rate: 0.04 },
      { sku: 'GL-10', name: 'Glass Set', last_month_orders: 12, this_month_orders: 11, price: 430, stock: 25, return_rate: 0.06 },
      ...tail('HK', S1001_TAIL, 11, 11, 380),
    ],
    // sample: traffic funnel
    visibility: {
      last_month: { impressions: 120000, clicks: 4800 },
      this_month: { impressions: 78000, clicks: 3000 },
    },
    // sample
    returns: {
      last_month_rate: 0.04,
      this_month_rate: 0.05,
      top_reasons: [
        { reason: 'Product quality not as expected', share: 0.4 },
        { reason: 'Damaged in transit', share: 0.25 },
        { reason: 'Wrong item sent', share: 0.2 },
        { reason: 'Other', share: 0.15 },
      ],
    },
    // sample: earlier months, `ago` = months before this month
    monthly_sales: [
      { ago: 5, sales: 190000 },
      { ago: 4, sales: 196000 },
      { ago: 3, sales: 205000 },
      { ago: 2, sales: 198000 },
      { ago: 1, sales: 200000 },
      { ago: 0, sales: 135000 },
    ],
    assumptions: [
      'Only the sales, orders, cancellation rate, average selling price and out-of-stock count are from the brief.',
      'Seller name, city, category and 60 active products are made up.',
      'Product names, per-product orders, stock and return rates (60 products) are sample data.',
      'Traffic (impressions, clicks), return reasons and earlier months of sales are sample data.',
      'Cancellation reasons, payments, competitor prices and ad spend are not available, so the bot asks or escalates.',
      '"This month" is treated as a completed month.',
    ],
  },
  {
    // price-driven scenario, proves the diagnosis follows the data
    _id: 'S1002',
    name: 'Meena Fashion Hub',
    owner: 'Meena',
    city: 'Lucknow',
    category: 'Women Ethnic Wear',
    active_skus: 45,
    metrics: {
      last_month: { sales: 200000, orders: 400, cancel_rate: 0.08, asp: 500, oos: 3 },
      this_month: { sales: 180000, orders: 300, cancel_rate: 0.08, asp: 600, oos: 3 },
    },
    products: [
      { sku: 'KT-01', name: 'Cotton Kurti Set', last_month_orders: 60, this_month_orders: 42, price: 650, stock: 0, return_rate: 0.06 },
      { sku: 'DP-02', name: 'Printed Dupatta', last_month_orders: 45, this_month_orders: 33, price: 450, stock: 120, return_rate: 0.04 },
      { sku: 'SR-03', name: 'Cotton Saree', last_month_orders: 38, this_month_orders: 28, price: 780, stock: 70, return_rate: 0.07 },
      ...tail('WE', S1002_TAIL, 4, 22, 520),
    ],
    visibility: {
      last_month: { impressions: 100000, clicks: 4000 },
      this_month: { impressions: 100000, clicks: 3000 },
    },
    returns: { last_month_rate: 0.06, this_month_rate: 0.06, top_reasons: [{ reason: 'Size or fit issue', share: 0.5 }, { reason: 'Other', share: 0.5 }] },
    monthly_sales: [
      { ago: 5, sales: 195000 },
      { ago: 4, sales: 198000 },
      { ago: 3, sales: 202000 },
      { ago: 2, sales: 199000 },
      { ago: 1, sales: 200000 },
      { ago: 0, sales: 180000 },
    ],
    assumptions: ['Entire seller is made up to demo a price-driven drop (average selling price rose 20%).'],
  },
  {
    // cancellation-driven scenario
    _id: 'S1003',
    name: 'Sunita Beauty Corner',
    owner: 'Sunita',
    city: 'Pune',
    category: 'Beauty & Personal Care',
    active_skus: 80,
    metrics: {
      last_month: { sales: 140000, orders: 350, cancel_rate: 0.05, asp: 400, oos: 4 },
      this_month: { sales: 132000, orders: 330, cancel_rate: 0.22, asp: 400, oos: 4 },
    },
    products: [
      { sku: 'BC-01', name: 'Vitamin C Face Serum', last_month_orders: 40, this_month_orders: 38, price: 420, stock: 150, return_rate: 0.05 },
      { sku: 'BC-02', name: 'Herbal Shampoo 340ml', last_month_orders: 36, this_month_orders: 34, price: 380, stock: 120, return_rate: 0.03 },
      { sku: 'BC-03', name: 'Sunscreen Lotion', last_month_orders: 30, this_month_orders: 29, price: 450, stock: 90, return_rate: 0.04 },
      ...tail('BC', S1003_TAIL, 4, 22, 340),
    ],
    visibility: {
      last_month: { impressions: 90000, clicks: 3600 },
      this_month: { impressions: 88000, clicks: 3500 },
    },
    returns: { last_month_rate: 0.04, this_month_rate: 0.04, top_reasons: [{ reason: 'Skin reaction or allergy', share: 0.35 }, { reason: 'Product different from photo', share: 0.35 }, { reason: 'Other', share: 0.3 }] },
    monthly_sales: [
      { ago: 5, sales: 135000 },
      { ago: 4, sales: 138000 },
      { ago: 3, sales: 142000 },
      { ago: 2, sales: 139000 },
      { ago: 1, sales: 140000 },
      { ago: 0, sales: 132000 },
    ],
    assumptions: ['Entire seller is made up to demo a cancellation-driven problem (cancellations 5% to 22%, everything else steady).'],
  },
  {
    // visibility-driven scenario
    _id: 'S1004',
    name: 'Vikram Mobile Accessories',
    owner: 'Vikram',
    city: 'Delhi',
    category: 'Mobile Accessories',
    active_skus: 70,
    metrics: {
      last_month: { sales: 150000, orders: 500, cancel_rate: 0.06, asp: 300, oos: 6 },
      this_month: { sales: 105000, orders: 350, cancel_rate: 0.06, asp: 300, oos: 6 },
    },
    products: [
      { sku: 'MA-01', name: 'Fast Charger 20W', last_month_orders: 70, this_month_orders: 48, price: 320, stock: 200, return_rate: 0.05 },
      { sku: 'MA-02', name: 'Bluetooth Earbuds', last_month_orders: 62, this_month_orders: 43, price: 350, stock: 150, return_rate: 0.08 },
      { sku: 'MA-03', name: 'Tempered Glass Pack', last_month_orders: 55, this_month_orders: 39, price: 250, stock: 400, return_rate: 0.03 },
      ...tail('MA', S1004_TAIL, 4, 25, 260),
    ],
    visibility: {
      last_month: { impressions: 200000, clicks: 8000 },
      this_month: { impressions: 110000, clicks: 4400 },
    },
    returns: { last_month_rate: 0.05, this_month_rate: 0.05, top_reasons: [{ reason: 'Not working or defective', share: 0.45 }, { reason: 'Not compatible with phone', share: 0.35 }, { reason: 'Other', share: 0.2 }] },
    monthly_sales: [
      { ago: 5, sales: 146000 },
      { ago: 4, sales: 149000 },
      { ago: 3, sales: 152000 },
      { ago: 2, sales: 148000 },
      { ago: 1, sales: 150000 },
      { ago: 0, sales: 105000 },
    ],
    assumptions: ['Entire seller is made up to demo a visibility-driven drop (impressions down 45%, price, stock and cancellations steady).'],
  },
  {
    // several causes at once
    _id: 'S1005',
    name: 'Fatima Sports Store',
    owner: 'Fatima',
    city: 'Hyderabad',
    category: 'Sports & Fitness',
    active_skus: 50,
    metrics: {
      last_month: { sales: 240000, orders: 300, cancel_rate: 0.06, asp: 800, oos: 4 },
      this_month: { sales: 189000, orders: 210, cancel_rate: 0.07, asp: 900, oos: 14 },
    },
    products: [
      { sku: 'SF-01', name: 'Yoga Mat Premium', last_month_orders: 32, this_month_orders: 4, price: 950, stock: 0, return_rate: 0.04 },
      { sku: 'SF-02', name: 'Adjustable Dumbbell Set', last_month_orders: 26, this_month_orders: 3, price: 1800, stock: 0, return_rate: 0.03 },
      { sku: 'SF-03', name: 'Resistance Band Kit', last_month_orders: 22, this_month_orders: 3, price: 650, stock: 0, return_rate: 0.05 },
      { sku: 'SF-04', name: 'Insulated Gym Bottle', last_month_orders: 30, this_month_orders: 26, price: 700, stock: 90, return_rate: 0.04 },
      { sku: 'SF-05', name: 'Gym Duffel Bag', last_month_orders: 24, this_month_orders: 20, price: 1100, stock: 45, return_rate: 0.06 },
      ...tail('SF', S1005_TAIL, 6, 14, 600),
    ],
    visibility: {
      last_month: { impressions: 110000, clicks: 4400 },
      this_month: { impressions: 95000, clicks: 3300 },
    },
    returns: { last_month_rate: 0.05, this_month_rate: 0.06, top_reasons: [{ reason: 'Size or quality not as expected', share: 0.45 }, { reason: 'Damaged in transit', share: 0.3 }, { reason: 'Other', share: 0.25 }] },
    monthly_sales: [
      { ago: 5, sales: 232000 },
      { ago: 4, sales: 238000 },
      { ago: 3, sales: 244000 },
      { ago: 2, sales: 236000 },
      { ago: 1, sales: 240000 },
      { ago: 0, sales: 189000 },
    ],
    assumptions: ['Entire seller is made up to demo a mixed drop: top products out of stock and average selling price up 12.5%.'],
  },
];
