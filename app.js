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
  let grandTotal = 0;

  for (const course of data) {
    const browser = await puppeteer.launch({
      headless: false,
    });
    const page = await browser.newPage();

    await page.goto(course.link);

    await page.waitForSelector('[data-purpose="enrollment"]');
    await page.waitForSelector('[data-purpose="course-old-price-text"]');

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
    course.price = $(
      '[data-purpose="course-old-price-text"] span:nth-child(2) s span'
    ).text();

    course.price = cleanPrice(course.price);

    let price = parseInt(course.price, 10);
    let total = students * price;

    course.total = total;
    grandTotal += total;

    await browser.close();
  }

  const fs = require("fs");
  fs.writeFileSync("./database/data.json", JSON.stringify(data, null, 2));

  const report = require("./database/report.json");

  report.grandTotal = grandTotal;
  report.mostProlificAuthor = "Wynter Jones";

  fs.writeFileSync("./database/report.json", JSON.stringify(report, null, 2));

  res.json({ grandTotal: grandTotal });
});

app.post("/get-marketvalue", async (req, res) => {
  const courses = req.body;
  let grandTotal = 0;

  for (const course of courses) {
    const url = course.link;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    let students = $('[data-purpose="enrollment"]').text();
    students = students.replace("students", "").trim();
    students = parseInt(students, 10);

    course.students = students;

    let price = parseInt(course.price, 10);
    let total = students * price;

    course.total = total;
    grandTotal += total;
  }

  res.json({ courses, grandTotal });
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
