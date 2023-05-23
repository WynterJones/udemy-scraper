var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());

app.post("/get-list", async (req, res) => {
  const keyword = req.body.keyword;
  const pageNumber = req.body.pageNumber;

  for (let i = 1; i <= parseInt(pageNumber); i++) {
    console.log(i, "started");
    await runStuff(i);
    console.log(i, "ended");
  }

  async function runStuff(i) {
    const browser = await puppeteer.launch({
      headless: false,
    });
    console.log(i, "running");
    const url = `https://www.udemy.com/courses/search/?p=${i}&q=${keyword}`;

    const page = await browser.newPage();
    await page.goto(url);

    await page.waitForSelector('[query="clickfunnels"]');

    let links = [];

    const content = await page.content();
    const $ = cheerio.load(content);

    $('[query="clickfunnels"]').each((index, element) => {
      const link =
        "https://www.udemy.com" +
        $(element).find('h3[data-purpose="course-title-url"] a').attr("href");
      const name = $(element)
        .find('h3[data-purpose="course-title-url"] a')
        .text();

      const price = null;

      const author = $(element)
        .find('[class^="course-card--instructor-list--"]')
        .text();
      const hours = parseFloat(
        $(element)
          .find('[data-purpose="course-meta-info"] span:nth-child(1)')
          .text()
      );
      const reviews = parseInt(
        $(element)
          .find("[aria-label]")
          .filter((i, el) => {
            return /\d+ reviews/.test($(el).attr("aria-label"));
          })
          .text()
          .replace("(", "")
          .replace(")", "")
          .trim()
      );
      const students = null;
      const total = null;
      const lectures = parseInt(
        $(element)
          .find('[data-purpose="course-meta-info"] span:nth-child(2)')
          .text()
      );

      links.push({
        link,
        name,
        author,
        reviews,
        price,
        students,
        total,
        hours,
        lectures,
      });
    });

    await browser.close();
    const data = require("./database/data.json");
    data.push(...links);
    const fs = require("fs");
    fs.writeFileSync("./database/data.json", JSON.stringify(data, null, 2));
    console.log("saved");
  }

  const data = require("./database/data.json");

  res.json({ saved: data.length });
});

app.post("/csv", async (req, res) => {
  const { Parser } = require("json2csv");
  const fields = [
    "name",
    "author",
    "reviews",
    "price",
    "students",
    "total",
    "hours",
    "lectures",
    "link",
  ];

  const opts = { fields };

  try {
    const data = require("./database/data.json");

    const parser = new Parser(opts);
    const csv = parser.parse(data);
    const fs = require("fs");
    fs.writeFileSync("./database/data.csv", csv);
    res.json({ saved: "true" });
  } catch (err) {
    console.error(err);
    res.json({ error: err });
  }
});

app.post("/get-prices", async (req, res) => {
  const data = require("./database/data.json");

  for (const course of data) {
    if (course.total === null) {
      const browser = await puppeteer.launch({
        headless: false,
      });
      const page = await browser.newPage();

      await page.goto(course.link);

      await page.waitForSelector('[data-purpose="enrollment"]');
      await Promise.race([
        page.waitForSelector('[data-purpose="course-old-price-text"]', {
          timeout: 5000,
        }),
        page.waitForSelector('[data-purpose="course-price-text"]', {
          timeout: 5000,
        }),
      ]);

      const content = await page.content();
      const $ = cheerio.load(content);

      let students = $('[data-purpose="enrollment"]').text();
      students = students.replace("students", "").trim();
      students = parseInt(students, 10);

      function cleanPrice(price) {
        const match = price.match(/\d+\.\d+/);
        if (match) {
          return parseFloat(match[0]);
        } else {
          return null;
        }
      }

      course.students = students;

      if ($('[data-purpose="course-old-price-text"]').text() !== "") {
        course.price = $(
          '[data-purpose="course-old-price-text"] span:nth-child(2) s span'
        ).text();
      } else if ($('[data-purpose="course-price-text"]').text() !== "") {
        course.price = $('[data-purpose="course-price-text"]').text();
      }

      course.price = cleanPrice(course.price) || 0;

      let price = parseInt(course.price, 10);
      let total = students * price;

      course.total = total;

      const randomSecondsBetween10and60Seconds = Math.floor(
        Math.random() * 50 + 1000
      );

      const fs = require("fs");
      fs.writeFileSync("./database/data.json", JSON.stringify(data, null, 2));

      await new Promise((r) =>
        setTimeout(r, randomSecondsBetween10and60Seconds)
      );

      await browser.close();
    }
  }

  res.json({ completed: data.length });
});

app.post("/get-report", async (req, res) => {
  const fs = require("fs");

  const report = require("./database/report.json");
  const data = require("./database/data.json");

  let grandTotal = 0;

  for (const course of data) {
    grandTotal += course.total;
  }

  const authorCount = data.reduce((acc, course) => {
    acc[course.author] = acc[course.author] ? acc[course.author] + 1 : 1;
    return acc;
  }, {});

  const topAuthors = Object.entries(authorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  const courseSales = data.reduce((acc, course) => {
    acc[course.name] = acc[course.name]
      ? acc[course.name] + course.total
      : course.total;
    return acc;
  }, {});

  const topCourses = Object.entries(courseSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, sales]) => ({ name, sales }));

  const sellerEarnings = data.reduce((acc, course) => {
    acc[course.author] = acc[course.author]
      ? acc[course.author] + course.total
      : course.total;
    return acc;
  }, {});

  const topSellers = Object.entries(sellerEarnings)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, earnings]) => ({ name, earnings }));

  report.grandTotal = grandTotal;
  report.mostProlificAuthors = topAuthors;
  report.bestSellingCourses = topCourses;
  report.highestPaidSellers = topSellers;

  fs.writeFileSync("./database/report.json", JSON.stringify(report, null, 2));

  res.json({ report: report });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server running on port ${port}`));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
