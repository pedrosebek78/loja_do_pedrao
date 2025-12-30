/* IMPORTAÇÃO DE MÓDULOS - http(requisições http - relação front -> back); mysql2(trabalhar com banco)*/

const { error } = require("console");
const http = require("http");
const mysql = require("mysql2");

/* UTILIZAÇÃO DA FUNÇÃO createConnection do objeto mysql para estabelecer uma conexão com o banco*/

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Pedro!3007",
    database: "tcg",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

/* CRIAÇÃO DE UM SERVIDOR, que irá receber reqs http do front, consultar o banco e responder à req - é criado utilizando o método createServer do objeto http */

const server = http.createServer((req, res) => {

    /* SETA HEADERS - informaões extras que vem nas requisições */
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    /* Front utiliza o método OPTIONS para confirmar se o método principal da requisição pode ser utilizado (preflight request), por estar concentrado em outra origem(porta, domínio), o navegador envia essa request automaticamente. Esse if confirma que está tudo certo e retorna 204(no response). E o return interrompe a execução da função*/
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    /* Caso o navegador esteja tentando buscar uma carta, a função dispara, escutando o evento data, ou seja, toda vez que um chunk é recebido, convertendo os chunks(buffers) em strings, e concatenando-os na string body. */
    if (req.method === "POST" && req.url === "/search") {
        let body = "";

        console.log("\n \n \n BACKEND FUNCIONANDO \n \n ")

        req.on("data", chunk => {
            body += chunk.toString();
        })

        /* Quando o evento "data" parar de disparar, o evento "end" dispara, desestruturando a string cardname dentro do JSON body e transformando-a em um objeto*/
        req.on("end", () => {
            const parsed = JSON.parse(body);
            console.log("Body recebido pelo Backend:", body, "\n \n", "Strings transformadas em objetos", parsed);
            const { cardname, manaValues } = parsed;
            console.log(manaValues)
            const search = `%${cardname}%`
            let manaArgumentString = "";
            let manaArgument = Array("w", "u", "b", "r", "g")
            let manas = Array()

            function checkLength(x) {
                if (x.length > 5) {
                    return true
                }
                return false;
            }

            if (!checkLength(manaValues)) {
                for (i = 0; i < manaValues.length; i++) {
                    if (manaValues[i] == true) {
                        manas.push(i);
                    }
                }
                manaArgument = manaArgument.filter((_, index) => !manas.includes(index));

                for (i = 0; i < manaArgument.length; i++) {
                    manaArgumentString += manaArgument[i];
                }
                manaArgumentString = `[${manaArgumentString}]`
            } else {
                manaArgumentString = "c"
            }


            console.log("\n \n", "Filtros retirados", manas, "\n \n", "Filtros utilizados", manaArgument, "\n \n", "String Banco: ", manaArgumentString);

            /* Realização do query no banco irá retornar um JSON contendo todas as cartas com cardname = search */
            db.query(
                "SELECT * FROM cards WHERE cardname LIKE ? AND color REGEXP ?", [search, manaArgumentString], (err, results) => {
                    if (err) {
                        res.writeHead(500, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: err.message }));
                        return;
                    }

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(results));
                    console.log("\n Resposta do banco: ", results)
                }
            )
        })
    }

    if (req.method === "POST" && req.url === "/deepSearch") {
        let body = "";

        req.on("data", c => {
            body += c.toString();
        });

        req.on("end", async () => {
            const parsed = JSON.parse(body);
            const { cardname, filter } = parsed;
            const filterString = filter.join(",")
            let cardsArr = Array()

            async function fe(x, y) {
                const response = await fetch(`https://api.magicthegathering.io/v1/cards?name=${x}&colors=${y}`)
                const data = await response.json()
                if (!data.cards[0]) {
                    return;
                } else {
                    console.log("\n\n RESPONSE FETCH : \n\n", response, "\n\n BODY DA RESPONSE: ", data, "\n\n CARTA INGLÊS: ", data.cards[0])
                    for (i = 0; i < 5; i++) {
                        const { name, colors, imageUrl } = data.cards[i]
                        cardsArr.push({
                            name : name,
                            colors : colors,
                            imageUrl : imageUrl
                        })
                    }
                    console.log("\n\n ARRAY DAS CARTAS:\n\n",cardsArr)
                    return cardsArr;

                }
            }

            const saviour = await fe(cardname, filterString)
            if (!saviour) {
                res.writeHead(500, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ deuRuim: true }))
            } else {
                res.writeHead(200, { "Content-Type": "application/json" })
                res.end(JSON.stringify({
                    saviour,
                    deuRuim : false
                }))
            }

            console.log("APENAS DADOS QUE QUERO: ", saviour)
        })
    }


    if (req.method === "POST" && req.url === "/submit") {
        let body = ""

        req.on("data", c => {
            body += c.toString()
        })

        req.on("end", () => {
            const parsed = JSON.parse(body)
            const { cn, cc, cp, ci } = parsed
            console.log(body, parsed)

            db.query(
                "INSERT INTO cards (cardname, color, price, image) VALUES (?, ?, ?, ?)",
                [cn, cc, cp, ci],
                (err, results) => {
                    if (err) {
                        res.writeHead(500, { "Content-Type": "application/json" })
                        res.end(JSON.stringify(err.message))
                        return;
                    }

                    res.writeHead(200, { "Content-Type": "application/json" })
                    res.end(JSON.stringify(results))
                }
            )
        })
        // let body = ""

        // req.on("data", c => {
        //     body += c.toString();
        // })

        // req.on("end", () => {
        //     console.log(body)
        // })
    }

    if (req.method === "POST" && req.url == "/delete") {
        let body = ""

        req.on("data", c => {
            body += c
        })

        req.on("end", () => {
            const parsed = JSON.parse(body);
            const { cardname } = parsed;

            db.query(
                "DELETE FROM cards WHERE cardname = ?",
                [cardname],
                (err, results) => {
                    if (err) {
                        resWriteHead(500, { "Content-type": "application/json" })
                        res.end(JSON.stringify(err.message))
                        return;
                    }

                    res.writeHead(200, { "Content-type": "application/json" });
                    res.end(JSON.stringify(results))
                }
            )


        })
    }

    if (req.method === "POST" && req.url === "/editPrice") {
        let body = ""

        req.on("data", c => {
            body += c.toString()
        })

        req.on("end", () => {
            const parsed = JSON.parse(body);
            const { cardName, newPrice } = parsed;

            db.query(
                "UPDATE cards SET price = ? WHERE cardname = ?;",
                [newPrice, cardName],
                (err, results) => {
                    if (err) {
                        res.writeHead(500, {"Content-Type" : "application/json"})
                        res.end(JSON.stringify({deuRuim : true}))
                        return;
                    } 

                    res.writeHead(200, {"Content-Type" : "application/json"})
                    res.end(JSON.stringify({results, deuRuim: false}))
                }
            )
        })


    }

    if (req.method === "POST" && req.url ==="/fetchAll") {
        let body = ""

        req.on("data", c => {
            body += c.toString()
        })

        req.on("end", () => {
            db.query(
                "SELECT * FROM cards",
                [],
                (err, results) => {
                    if (err) {
                        res.writeHead(500, {"Content-Type" : "application/json"})
                        res.end(JSON.stringify({
                            error : err.message,                       
                            deuRuim : true
                        }))
                        return;
                    }
    
                    res.writeHead(200, {"Content-Type" : "application/json"})
                    res.end(JSON.stringify({
                        results,
                        deuRuim : false
                    }))
                }
            )
        })

    }



}
)
server.listen(3000, () => {
    console.log("Rodando!");
})



