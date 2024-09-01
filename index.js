const express = require("express");
const app = express();
const { MongoClient } = require("mongodb");
const uri =
  "mongodb+srv://root:root123@mycluster.flhjk.mongodb.net/?retryWrites=true&w=majority&appName=MyCluster";
let db = null;

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    db = client.db("member-msg-board");
    console.log("資料庫連線成功");
  } catch (err) {
    console.log("連線失敗", err);
  }
}

// 伺服器基礎設定
const session = require("express-session");
app.use(
  session({
    secret: "anything",
    resave: false,
    saveUninitialized: true,
  })
);
app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// 處理路由
app.get("/error", (req, res) => {
  const msg = req.query.msg;
  res.render("error.ejs", { msg: msg });
});

// POST 把註冊資料傳至資料庫
app.post("/", async (req, res) => {
  const collection = db.collection("member");
  const { name, email, password } = req.body;
  try {
    // 檢查電子郵件是否已重複註冊
    const result = await collection.findOne({
      email: email,
    });

    // 確認信箱未註冊過，且所有輸入框都有內容
    if (result || !name || !email || !password) {
      res.redirect("/error?msg=註冊失敗，信箱重複或填寫資料未完整");
      return;
    }

    await collection.insertOne({
      name,
      email,
      password,
    });
  } catch (err) {
    console.error("加載數據失敗", err);
    res.status(500).send("服務器錯誤");
  }
});

app.get("/member", async (req, res) => {
  if (!req.session.member) {
    res.redirect("/");
    return;
  }

  const name = req.session.member.name;

  const collection = db.collection("msg");
  let result = await collection.find({}).sort({ date: 1 }).toArray();
  res.render("member.ejs", { name: name, data: result });
});

// 登入會員驗證
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  const collection = db.collection("member");
  const result = await collection.findOne({
    $and: [{ email }, { password }],
  });

  if (result === null) {
    res.redirect("/error?msg=登入失敗，郵件或密碼錯誤");
    return;
  }

  // 登入成功，紀錄會員紀錄在 Session 中
  req.session.member = result;
  res.redirect("member");
});

// 登出會員
app.get("/signout", (req, res) => {
  req.session.member = null;
  res.redirect("/");
});

// 留言板
app.post("/member", async (req, res) => {
  const collection = db.collection("msg");
  try {
    const name = req.session.member.name;
    const date = new Date();
    const msg = req.body.msg;
    await collection.insertOne({
      name,
      msg,
      date,
    });

    const result = await collection.find({}).sort({ date: 1 }).toArray();
    res.render("member.ejs", { name: name, data: result });
  } catch (err) {
    console.log("留言失敗", err);
    res.status(500).send("服務器錯誤");
  }
});

main().then(() => {
  app.listen(3000, function () {
    console.log("Sever Started");
  });
});
