require("http").createServer((_, res) => res.end("Hello World!")).listen(8080, () => console.log("Yay the web server is online!"));
