const http = require('https');
const { wix_api_key, wix_site_id } = require('../riskbot_config.json');

async function sendHttpRequest(options, postData) {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
          let data = "";

          res.on("data", (chunk) => {
              data += chunk;
          });

          res.on("end", () => {
              resolve(data);
          });
      });

      req.on("error", (error) => {
          reject(error);
      });

      if (postData) {
          req.write(postData);
      }

      req.end();
    });
}

async function wixDataFetcher(requestData) {
    const options_query = {
        host: 'www.wixapis.com',
        port: 443,
        path: '/wix-data/v2/items/query',
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Authorization': wix_api_key,
        'wix-site-id': wix_site_id,
        },
    };

    try {
        const res = await sendHttpRequest(options_query, requestData);
        const response = JSON.parse(res).dataItems;
        return response;
    } catch (error) {
        throw new Error(`Error fetching Wix collection data: ${error.message}`);
    }
}

module.exports = {
    wixDataFetcher,
};