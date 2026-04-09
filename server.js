const express = require('express');
const session = require('express-session');
const path = require('path');
const ExcelJS = require('exceljs');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose'); // ✨ MongoDB 연동 도구 추가
const app = express();

const publicPath = path.join(__dirname, 'public');
const uploadsPath = path.join(__dirname, 'uploads');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath)); 
app.use('/uploads', express.static(uploadsPath));

app.use(session({
    secret: 'ssafy-pro-ultimate-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000, httpOnly: true }
}));

const upload = multer({ dest: uploadsPath });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);

// ==========================================
// ✨ 1-1. MongoDB 연결 및 스키마 설정
// ==========================================
// 🚨 아래 <password> 부분을 대표님의 진짜 비밀번호로 바꿔주세요!
const MONGO_URI = "mongodb+srv://kkdlove999_dk_9:qlfeld2323!@cluster0.rx5jxnx.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB 연결 성공! (데이터 영구 보존 모드)"))
    .catch(err => console.error("❌ MongoDB 연결 실패:", err));

// MongoDB 창고 모델 정의
const User = mongoose.model('User', new mongoose.Schema({
    id: String, pw: String, name: String, phone: String, joinDate: String
}));

const Order = mongoose.model('Order', new mongoose.Schema({
    id: Number, userId: String, orderDate: String, items: Array, totalAmount: String,
    name: String, address: String, phone: String, status: String, courier: String, trackingNumber: String
}));

const Review = mongoose.model('Review', new mongoose.Schema({
    productId: String, content: String, userId: String, date: String
}));

const Qna = mongoose.model('Qna', new mongoose.Schema({
    title: String, content: String, isSecret: Boolean, userId: String, date: String, answer: String
}));

// ==========================================
// 1. 데이터베이스 세팅 (가격 120, 90, 150 반영)
// ==========================================
// db_users, db_orders, db_reviews, db_qna는 이제 모두 MongoDB가 안전하게 보관합니다.

let db_products = [
    { id: 1, name: "고급 기계식 키보드", price: 120, category: "전자제품", img: "/uploads/keyboard.jpg", desc: "최고의 타건감, 개발자 필수 아이템.", stock: 50 },
    { id: 2, name: "인체공학 무선 마우스", price: 90, category: "전자제품", img: "/uploads/mouse.jpg", desc: "손목이 편안한 인체공학 설계.", stock: 100 },
    { id: 3, name: "프리미엄 사무용 의자", price: 150, category: "가구", img: "/uploads/chair.jpg", desc: "장시간 업무에도 편안한 지지력.", stock: 10 }
];

let db_coupons = [{ code: "PRO2026", discount: 15000 }];

const checkLogin = (req, res, next) => req.session.userId ? next() : res.status(401).json({ message: "로그인이 필요합니다." });

// ==========================================
// 2. 상품 및 리뷰 API 
// ==========================================
app.get('/api/products', (req, res) => res.json(db_products));

app.get('/api/products/:id', (req, res) => {
    const p = db_products.find(item => item.id == req.params.id);
    if (p) {
        res.json(p);
    } else {
        res.status(404).json({ message: "상품 없음" });
    }
});

app.get('/api/reviews/:productId', async (req, res) => {
    const reviews = await Review.find({ productId: String(req.params.productId) });
    res.json({ reviews });
});

// [복구 완료] 구매확정 시에만 후기 작성 허용 로직
app.post('/api/reviews', checkLogin, async (req, res) => {
    const { productId, content } = req.body;
    
    // 사용자의 모든 주문을 불러와서 구매확정 상태이고 해당 상품이 있는지 검사
    const userOrders = await Order.find({ userId: req.session.userId, status: "구매확정" });
    const hasPurchased = userOrders.some(o => 
        o.items.some(item => String(item.id) === String(productId))
    );

    if (!hasPurchased) {
        return res.json({ success: false, message: "구매확정 단계에서만 작성할 수 있습니다." });
    }

    await new Review({ 
        productId, 
        content, 
        userId: req.session.userId, 
        date: new Date().toLocaleString() 
    }).save();
    
    res.json({ success: true });
});

// ==========================================
// 3. 회원 및 인증 API (아이디/비번 찾기 포함)
// ==========================================
app.post('/api/signup', async (req, res) => {
    const { userId, userPw, userName, userPhone } = req.body;
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    
    if (!phoneRegex.test(userPhone)) {
        return res.json({ success: false, message: "핸드폰 번호 형식이 올바르지 않습니다." });
    }
    
    const existingUser = await User.findOne({ id: userId });
    if(existingUser) {
        return res.json({ success: false, message: "이미 사용 중인 아이디입니다." });
    }
    
    await new User({ id: userId, pw: userPw, name: userName, phone: userPhone, joinDate: new Date().toLocaleString() }).save();
    res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
    const { userId, userPw } = req.body;
    const user = await User.findOne({ id: userId, pw: userPw });
    if(user) { 
        req.session.userId = userId; 
        res.json({ success: true }); 
    } else {
        res.json({ success: false, message: "입력하신 정보는 올바르지 않습니다." });
    }
});

// [복구 완료] 실패 시 응답 문구 완벽 고정
app.post('/api/find-id', async (req, res) => {
    const { name, phone } = req.body;
    const user = await User.findOne({ name: name, phone: phone });
    if(user) {
        res.json({ success: true, userId: user.id });
    } else {
        res.json({ success: false, message: "입력하신 정보는 올바르지 않습니다." });
    }
});

app.post('/api/find-pw', async (req, res) => {
    const { userId, name, phone } = req.body;
    const user = await User.findOne({ id: userId, name: name, phone: phone });
    if(user) {
        res.json({ success: true, userPw: user.pw });
    } else {
        res.json({ success: false, message: "입력하신 정보는 올바르지 않습니다." });
    }
});

app.get('/api/logout', (req, res) => { 
    req.session.destroy(); 
    res.redirect('/'); 
});

// ==========================================
// 4. 마이페이지 API (등급 및 누적 금액 실시간 계산)
// ==========================================
app.get('/api/user/me', checkLogin, async (req, res) => {
    const user = await User.findOne({ id: req.session.userId });
    if (!user) return res.status(404).json({ message: "사용자 없음" });

    const userOrders = await Order.find({ userId: req.session.userId });
    const totalSpent = userOrders.reduce((sum, o) => {
        const amountStr = o.totalAmount ? String(o.totalAmount).replace(/[^0-9]/g, '') : "0";
        return sum + Number(amountStr);
    }, 0);
    
    let grade = "일반회원";
    if (totalSpent >= 1000000) grade = "VIP";
    else if (totalSpent >= 300000) grade = "우수회원";

    res.json({ ...user.toObject(), totalSpent, grade });
});

// ==========================================
// 5. 주문, 쿠폰, 배송 관리 API
// ==========================================
app.post('/api/check-coupon', (req, res) => {
    const { code } = req.body;
    const coupon = db_coupons.find(c => c.code === code);
    if (coupon) {
        res.json({ success: true, discount: coupon.discount });
    } else {
        res.json({ success: false, message: "유효하지 않거나 만료된 쿠폰입니다." });
    }
});

app.post('/api/order', checkLogin, async (req, res) => {
    const { items, totalAmount, name, address, phone } = req.body;
    await new Order({ 
        id: Date.now(), 
        userId: req.session.userId, 
        orderDate: new Date().toLocaleString(), 
        items, 
        totalAmount, 
        name, 
        address, 
        phone, 
        status: "결제완료",
        courier: null,
        trackingNumber: null
    }).save();
    res.json({ success: true });
});

app.get('/api/my-orders', checkLogin, async (req, res) => {
    const myOrders = await Order.find({ userId: req.session.userId });
    res.json(myOrders);
});

app.post('/api/user/order-confirm', checkLogin, async (req, res) => {
    const order = await Order.findOne({ id: req.body.orderId, userId: req.session.userId });
    if (order) {
        order.status = "구매확정";
        await order.save();
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "주문 정보가 없습니다." });
    }
});

// ==========================================
// 6. 관리자(Admin) 전용 API
// ==========================================
app.get('/api/admin/orders', checkLogin, async (req, res) => {
    const orders = await Order.find();
    res.json(orders);
});

// [복구 완료] 배송중 변경 시 30초 후 배송완료 자동 처리
app.post('/api/admin/order-status', checkLogin, async (req, res) => {
    const { orderId, status, courier, trackingNumber } = req.body;
    const order = await Order.findOne({ id: orderId });
    
    if (order) {
        order.status = status;
        
        if (status === "배송중") {
            order.courier = courier; 
            order.trackingNumber = trackingNumber;
            await order.save();
            
            setTimeout(async () => {
                const targetOrder = await Order.findOne({ id: orderId });
                if (targetOrder && targetOrder.status === "배송중") {
                    targetOrder.status = "배송완료";
                    await targetOrder.save();
                    console.log(`[시스템] 주문번호 ${orderId} : 배송완료 자동 처리됨`);
                }
            }, 30000);
        } else {
            await order.save();
        }
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

// [복구 완료] 엑셀 다운로드 (배송지 주소, 택배사, 송장번호까지 완벽하게 포함)
app.get('/api/admin/excel', async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Orders');
    
    sheet.columns = [
        { header: '주문일시', key: 'date', width: 22 },
        { header: '주문자', key: 'name', width: 15 },
        { header: '연락처', key: 'phone', width: 18 },
        { header: '배송지 주소', key: 'address', width: 40 },
        { header: '상품금액', key: 'amount', width: 15 },
        { header: '상태', key: 'status', width: 12 },
        { header: '택배사', key: 'courier', width: 15 },
        { header: '송장번호', key: 'trackingNumber', width: 20 }
    ];
    
    const orders = await Order.find();
    orders.forEach(o => {
        sheet.addRow({ 
            date: o.orderDate, 
            name: o.name, 
            phone: o.phone || '정보 없음', 
            address: o.address || '정보 없음', 
            amount: o.totalAmount, 
            status: o.status,
            courier: o.courier || '-',
            trackingNumber: o.trackingNumber || '-'
        });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=orders_full_data.xlsx');
    await workbook.xlsx.write(res);
    res.end();
});

// ==========================================
// 7. Q&A 게시판 및 라우팅
// ==========================================
app.get('/api/qna', async (req, res) => {
    const qnas = await Qna.find();
    res.json(qnas);
});

app.post('/api/qna', checkLogin, async (req, res) => {
    const { title, content, isSecret } = req.body;
    await new Qna({ 
        title, 
        content, 
        isSecret: isSecret || false,
        userId: req.session.userId, 
        date: new Date().toLocaleString(), 
        answer: null 
    }).save();
    res.json({ success: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(publicPath, 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'login.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 [Admin Master] Live on http://localhost:${PORT} (MongoDB Connected)`));
