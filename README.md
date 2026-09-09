# Sales-Management-Panel

# 📊 Sales Desk

> A lightweight, multi-project sales CRM and call management dashboard built with Vanilla JavaScript, LocalStorage, and Docker.

**Sales Desk** is a simple and fast sales workspace designed for managing leads, sales calls, follow-ups, tasks, notes, scripts, and archived contacts — without requiring a backend or database.

It is designed especially for freelancers, sales representatives, small teams, and anyone who needs a personal sales workspace that works locally.

---

## ✨ Features

### 📁 Multi-Project Workspace

Manage multiple sales projects independently.

You can create separate projects for different clients, companies, campaigns, or sales operations.

Each project keeps its own:

* Leads
* Call history
* Archive
* Tasks
* Notes
* Scripts

Example:

```text
Sales Desk
│
├── Project A
│   ├── Leads
│   ├── Calls
│   ├── Archive
│   ├── Tasks
│   ├── Notes
│   └── Scripts
│
└── Project B
    ├── Leads
    ├── Calls
    ├── Archive
    ├── Tasks
    ├── Notes
    └── Scripts
```

---

### 📞 Lead & Call Management

Manage your sales leads from one place.

Track:

* Lead name
* Company
* Phone number
* Status
* Notes
* Call history
* Follow-ups
* Sales results

Record every interaction and keep your sales pipeline organized.

---

### 📦 Lead Archive

When a lead reaches a final state such as:

* Won
* Lost
* Not Interested
* Closed

the lead can be moved to the archive instead of being permanently deleted.

This keeps your active workspace clean while preserving historical data.

Archived leads can also be restored when needed.

---

### 📈 Sales Dashboard

The dashboard provides an overview of your sales activity.

It includes useful metrics such as:

* Total leads
* Calls
* Interested leads
* Follow-ups
* Won deals
* Lost leads
* Conversion metrics

The dashboard also includes visual charts for understanding sales activity and pipeline performance.

---

### 📊 Sales Analytics

Visualize your sales data with charts and analytics.

Examples include:

* Call activity
* Lead status distribution
* Sales funnel
* Conversion performance
* Lost lead reasons
* Sales progress

The goal is to make your sales activity easier to understand at a glance.

---

### 📝 Notebook

A built-in notebook for keeping important information.

Use it for:

* Meeting notes
* Ideas
* Sales observations
* Client information
* Call notes
* Personal reminders

Notes are stored locally and associated with the current project.

---

### ✅ Checklist & Tasks

Manage your daily sales tasks directly inside the application.

Create tasks such as:

```text
☐ Call Company A
☐ Send proposal
☐ Follow up with Company B
☑ Prepare demo
```

Tasks support:

* Completion status
* Priority
* Project-based organization
* Progress tracking

---

### 📚 Script Library

Keep your sales scripts organized and accessible.

Scripts can be organized using categories and subcategories.

Example:

```text
Scripts
│
├── Cold Call
│   ├── Opening
│   ├── Discovery
│   ├── Qualification
│   └── Closing
│
├── Follow Up
│   ├── Phone
│   ├── WhatsApp
│   └── Email
│
└── Objection Handling
    ├── Too Expensive
    ├── Not Interested
    ├── Already Have A System
    └── Send Me Information
```

You can create, edit, organize, and delete your own scripts.

---

## 🧠 Local-First Architecture

Sales Desk does not require a backend server or external database.

Data is stored locally using:

```text
Browser
   ↓
LocalStorage
   ↓
Sales Desk
```

This makes the application:

* Fast
* Simple
* Private
* Easy to deploy
* Easy to run locally
* Independent from external services

> **Important:** Because data is stored in browser LocalStorage, clearing browser storage can remove application data. Export/backup functionality can be added in future versions.

---

## 🛠️ Tech Stack

| Technology         | Purpose                   |
| ------------------ | ------------------------- |
| HTML5              | Application structure     |
| CSS3               | UI and responsive styling |
| Vanilla JavaScript | Application logic         |
| LocalStorage       | Local data persistence    |
| Nginx              | Static web server         |
| Docker             | Containerization          |

No framework is required.

No React.

No TypeScript.

No backend.

No external database.

---

# 🐳 Run with Docker

## Requirements

Make sure you have:

* Docker
* Git

installed on your machine.

---

## Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/sales-desk.git
cd sales-desk
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Build the Docker image

```bash
docker build -t sales-desk .
```

---

## Run the container

```bash
docker run -d \
  --name sales-desk \
  --restart unless-stopped \
  -p 8888:80 \
  sales-desk
```

Open:

```text
http://localhost:8888
```

---

## Check the container

```bash
docker ps
```

You should see:

```text
sales-desk
```

with:

```text
0.0.0.0:8888->80/tcp
```

---

## Stop the application

```bash
docker stop sales-desk
```

---

## Start it again

```bash
docker start sales-desk
```

Because the container uses:

```text
--restart unless-stopped
```

Docker will automatically restart it after a system reboot.

---

# 💻 Run Without Docker

Because this is a static frontend application, you can also run it without Docker.

Simply open:

```text
index.html
```

in a modern browser.

However, using a local web server is recommended for a more realistic deployment environment.

---

# 📂 Project Structure

```text
sales-desk/
│
├── index.html       # Main application UI
├── style.css        # Application styles
├── app.js           # Application logic
├── Dockerfile       # Docker configuration
└── README.md        # Documentation
```

---

# 🔐 Data & Privacy

Sales Desk is designed as a local-first application.

Your sales data is stored inside your browser's LocalStorage rather than being sent to a remote server.

This means:

* No external database is required
* No login system is required
* No cloud account is required
* No API is required
* Data remains on the local browser

However, LocalStorage is not a replacement for a proper database for production or multi-user environments.

---

# 🚀 Roadmap

The project can evolve into a more complete CRM platform.

### Planned / Possible Improvements

* [ ] Import / Export data
* [ ] Automatic backups
* [ ] CSV export
* [ ] JSON backup
* [ ] Advanced lead filtering
* [ ] Lead search
* [ ] Custom pipeline stages
* [ ] Drag & drop Kanban board
* [ ] Advanced sales analytics
* [ ] Calendar
* [ ] Follow-up reminders
* [ ] Script search
* [ ] Script templates
* [ ] Dark / Light themes
* [ ] User authentication
* [ ] Backend API
* [ ] PostgreSQL database
* [ ] Multi-user collaboration
* [ ] Cloud synchronization
* [ ] Mobile-friendly improvements

---

# 🎯 Use Cases

Sales Desk can be useful for:

* Freelancers
* Sales representatives
* Small businesses
* Marketing agencies
* Automation agencies
* Lead generation teams
* Cold calling
* B2B sales
* Follow-up management
* Personal sales operations

---

# 🤝 Contributing

Contributions are welcome.

If you have an idea, improvement, or bug fix:

1. Fork the repository
2. Create a new branch

```bash
git checkout -b feature/my-feature
```

3. Make your changes
4. Commit them

```bash
git commit -m "Add: new sales feature"
```

5. Push your branch

```bash
git push origin feature/my-feature
```

6. Open a Pull Request

---

# 🐛 Issues & Feature Requests

Found a bug or have an idea?

Open an issue and describe:

* What happened
* What you expected
* Steps to reproduce
* Screenshots if applicable

---

# 📜 License

This project is currently available for personal and educational use.

A formal open-source license can be added in a future release.

---

# 🇮🇷 فارسی

## 📊 Sales Desk چیست؟

**Sales Desk** یک CRM سبک و چندپروژه‌ای برای مدیریت فرآیند فروش است که با هدف ساده‌کردن مدیریت لیدها، تماس‌های فروش و پیگیری مشتریان ساخته شده است.

این پروژه بدون Backend و Database خارجی کار می‌کند و اطلاعات را به‌صورت Local در مرورگر ذخیره می‌کند.

---

## ✨ امکانات

### 📁 مدیریت چند پروژه

می‌توانید برای مشتری‌ها، شرکت‌ها یا کمپین‌های مختلف پروژه‌های جداگانه بسازید.

برای مثال:

```text
Sales Desk
│
├── پروژه مشتری اول
│   ├── لیدها
│   ├── تماس‌ها
│   ├── بایگانی
│   ├── وظایف
│   ├── دفترچه
│   └── اسکریپت‌ها
│
└── پروژه مشتری دوم
    ├── لیدها
    ├── تماس‌ها
    ├── بایگانی
    ├── وظایف
    ├── دفترچه
    └── اسکریپت‌ها
```

اطلاعات پروژه‌ها از یکدیگر جدا هستند.

---

### 📞 مدیریت لید و تماس

برای هر Lead می‌توانید اطلاعات مختلفی را مدیریت کنید:

* نام
* شرکت
* شماره تماس
* وضعیت
* یادداشت
* تاریخچه تماس
* Follow-up
* نتیجه فروش

---

### 📦 بایگانی مشتریان

وقتی وضعیت یک Lead به حالت نهایی برسد، می‌توان آن را به بایگانی منتقل کرد.

مثلاً:

```text
فروش موفق
رد شده
علاقه‌مند نبود
بسته شده
```

اطلاعات Lead حذف نمی‌شود و در صورت نیاز امکان بازگردانی آن وجود دارد.

---

### 📊 داشبورد فروش

داشبورد اطلاعات مهم فروش را نمایش می‌دهد، از جمله:

* تعداد لیدها
* تعداد تماس‌ها
* لیدهای علاقه‌مند
* Follow-upها
* فروش‌های موفق
* لیدهای از دست رفته
* نرخ تبدیل

همچنین نمودارهایی برای تحلیل وضعیت فروش در اختیار شما قرار می‌گیرد.

---

### 📝 دفترچه

یک Notebook داخلی برای ذخیره:

* یادداشت جلسات
* ایده‌ها
* نکات تماس
* اطلاعات مشتری
* یادداشت‌های شخصی
* اطلاعات مهم پروژه

---

### ✅ چک‌لیست

برای مدیریت کارهای فروش می‌توانید Task ایجاد کنید:

```text
☐ تماس با شرکت A
☐ ارسال پیشنهاد
☐ Follow-up شرکت B
☑ آماده‌کردن Demo
```

---

### 📚 کتابخانه اسکریپت

تمام Scriptهای فروش را می‌توان داخل برنامه مدیریت کرد.

ساختار پیشنهادی:

```text
اسکریپت‌ها
│
├── تماس سرد
│   ├── شروع مکالمه
│   ├── Discovery
│   ├── Qualification
│   └── Closing
│
├── Follow Up
│   ├── تماس
│   ├── واتساپ
│   └── ایمیل
│
└── مدیریت اعتراضات
    ├── گرونه
    ├── علاقه نداریم
    ├── خودمون سیستم داریم
    └── اطلاعات رو ارسال کنید
```

---

## 🔒 ذخیره‌سازی اطلاعات

Sales Desk یک برنامه **Local-First** است.

اطلاعات در:

```text
Browser
   ↓
LocalStorage
```

ذخیره می‌شوند.

بنابراین برای اجرای نسخه فعلی نیازی به:

* Backend
* Database
* API
* Login
* Cloud

ندارید.

> توجه: پاک‌کردن Storage مرورگر می‌تواند باعث حذف اطلاعات شود. در نسخه‌های آینده امکان Backup و Export می‌تواند اضافه شود.

---

## 🐳 اجرای پروژه با Docker

ابتدا Image را بسازید:

```bash
docker build -t sales-desk .
```

سپس:

```bash
docker run -d \
  --name sales-desk \
  --restart unless-stopped \
  -p 8888:80 \
  sales-desk
```

سپس وارد شوید:

```text
http://localhost:8888
```

---

## 🧰 تکنولوژی‌ها

```text
HTML5
CSS3
Vanilla JavaScript
LocalStorage
Docker
Nginx
```

---

## 🚀 مسیر توسعه

ایده‌هایی که می‌توانند در نسخه‌های بعدی اضافه شوند:

* Backup
* Import / Export
* CSV Export
* JSON Backup
* جستجوی پیشرفته Lead
* فیلترهای حرفه‌ای
* Kanban Board
* Calendar
* Reminder
* Follow-up خودکار
* تحلیل پیشرفته فروش
* Script Search
* Dark Mode
* Backend
* PostgreSQL
* Authentication
* Multi-user
* Cloud Sync

---

## 🤝 مشارکت

اگر ایده‌ای برای بهترشدن پروژه دارید، می‌توانید:

1. Repository را Fork کنید.
2. یک Branch جدید بسازید.
3. تغییرات را اعمال کنید.
4. Pull Request ارسال کنید.

---

## 📄 License

این پروژه در حال حاضر برای استفاده شخصی و آموزشی ارائه شده است.

مجوز Open Source رسمی می‌تواند در نسخه‌های بعدی اضافه شود.

---

## ⭐ اگر پروژه برای شما مفید بود

اگر Sales Desk برایتان مفید بود، یک ⭐ روی Repository بگذارید.

این کار به توسعه پروژه کمک می‌کند.

---

**Built with ❤️ using Vanilla JavaScript**
