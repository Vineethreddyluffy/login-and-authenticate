const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
  }
};

initializeDBAndServer();

const authenticate = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken === undefined) {
    request.status(401);
    request.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "vineethreddy", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payLoad.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const userDetails = request.body;
  const { username, password } = userDetails;
  const dbQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordSame = await bcrypt.compare(password, dbResponse.password);
    if (isPasswordSame === true) {
      const payLoad = {
        username: username,
      };
      const jwtToken = jwt.sign(payLoad, "vineethreddy");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const toCamelCase = (dbResponse) => {
  const newArr = dbResponse.map((each) => {
    return {
      stateId: each.state_id,
      stateName: each.state_name,
      population: each.population,
    };
  });
  return newArr;
};

const toCamelCase1 = (dbResponse) => {
  const newArr = {
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
  };
  return newArr;
};

app.get("/states/", authenticate, async (request, response) => {
  const dbQuery = `SELECT * FROM state ORDER BY state_id;`;
  const dbResponse = await db.all(dbQuery);
  response.send(toCamelCase(dbResponse));
});

app.get("/states/:stateId/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  const dbQuery = `SELECT * FROM state WHERE state_id=${stateId};`;
  const dbResponse = await db.get(dbQuery);
  response.send(toCamelCase1(dbResponse));
});

app.post("/districts/", authenticate, async (request, response) => {
  const details = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = details;
  const dbQuery = `
    INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(dbQuery);
  response.send("District Successfully Added");
});

const toDistrict = (dbResponse) => {
  const newArr = {
    districtId: dbResponse.district_id,
    districtName: dbResponse.district_name,
    stateId: dbResponse.state_id,
    cases: dbResponse.cases,
    cured: dbResponse.cured,
    active: dbResponse.active,
    deaths: dbResponse.deaths,
  };
  return newArr;
};

app.get("/districts/:districtId/", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const dbQuery = `SELECT * FROM district WHERE district_id=${districtId};`;
  const dbResponse = await db.get(dbQuery);
  response.send(toDistrict(dbResponse));
});

app.delete(
  "/districts/:districtId/",
  authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const dbQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(dbQuery);
    response.send("District Removed");
  }
);

app.put("/districts/:districtId/", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const details = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = details;
  const dbQuery = `
    UPDATE district 
    SET
        district_name='${districtName}',
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
    WHERE district_id=${districtId};`;
  await db.run(dbQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  const dbQuery = `
    SELECT 
        SUM(district.cases) AS totalCases,
        SUM(district.cured) AS totalCured,
        SUM(district.active) AS totalActive,
        SUM(district.deaths) AS totalDeaths
    FROM state NATURAL JOIN district
    WHERE state.state_id=${stateId};
    `;
  const dbResponse = await db.get(dbQuery);
  response.send(dbResponse);
});

module.exports = app;
