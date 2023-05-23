# Udemy Scraper

This is a node express app that is intended to run locally on your own computer. You must have NodeJS installed on your computer and Google Chrome Browser.

This app will search Udemy and grab the list of links from the search, get price and students from each link and create reports in JSON format ready to give to ChatGPT to make it pretty and run analytics on.

## Install

Run in your terminal:

```
npm install
```

## Start Server

Run in your terminal:

```
npm run start
```

> Note: you can do `npm run dev` if you want to run `nodemon` which hot-reload on file changes if changing code.

## Run Requests with Postman

Download Postman for Windows or Mac. This is a desktop app that makes it easy to run requests. 

## Step #1: Get Lists of Links

The app will take in a `keyword` and `pageNumber` and create a list of links which will be saved to the `database/data.json` file. 

**Important:** First you must open that file `database/data.json` and make sure it only has `[]` if you are starting fresh.

You will need to do a `POST` request to this URL when the local server is running:

```
http://localhost:3001/get-list
```

You will need to post JSON, which you can do by clicking `Body > Raw > JSON (dropown)` inside of Postamn with the following:

```
{
 "keyword": "clickfunnels",
 "pageNumber": 14
}
```

The `pageNumber` is found by actually visiting the udemy website and doing a search, you have to find out this number.

Once you run this this will create the first part of the `database/data.json` file. The `price`, `students`, and `total` will be be `null` at this point.

## Step #2: Get Prices

Now you must run a `POST` request to the following:

```
http://localhost:3001/get-list
```

These is no data that you need to send it like the 1st step. This will take the data it created and find the proper price, student and create a total. 

**This part will take awhile, please be patient.**

Once this part is done then you can continue or create a `CSV` file by running another request:

```
http://localhost:3001/csv
```

And then you can view the file `database/data.csv` to run your own analytics on.

## Step #3: Run Reports

You have two options which will run a report on everything or another where it will only check if a `keyword` is inside the name of the course.

**Option #1: Report on Everything**

```
http://localhost:3001/get-report
```

No data is required to be passed. You can then take the response which will be JSON and then paste this into a ChatGPT chat to ask for stats or more processing.

**Option #2: Report with Keyword**

```
http://localhost:3001/get-report-keyword
```

This will require the following JSON data to be passed like it step #1:

```
{
"keyword": "clickfunnels"
}
```

You can then take the response which will be JSON and then paste this into a ChatGPT chat to ask for stats or more processing.

# Advanced

You can then edit the code to do more as you would like. 

The reason this is local and not in real server because it is not `headless` because Udemy will block you using cloudflare to verify you are not a bot. So you must have the web browser actually open up. 

# Thank You

If you found this helpful, you can support my content here: https://www.buymeacoffee.com/wyntera




