const request = require('request-promise');
const accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZDM0NTQ2NC0zODQ2LTRmMmYtODI5Yi1hMGQxODgxMzc5M2IiLCJpZCI6NzU4LCJpYXQiOjE2MDkzMDAyMDJ9.gLTs2dRIDfU8ZAuA0qIAAxrO8UzKPjHad9Gc1JUmx18";
const postBody = {
    name: 'Air_quality_CauGiay',
    description: 'Air quality 3D map of CauGiay',
    type: '3DTILES',
    options: {
        sourceType: '3DTILES',
        clampToTerrain: true,
        baseTerrainId: 1
    }
}

// create the asset
async function send_request () {
	const response = await request({
	    url: 'https://api.cesium.com/v1/assets',
	    method: 'POST',
	    headers: { Authorization: `Bearer ${accessToken}` },
	    json: true,
	    body: postBody
	});
	
	//upload data via Amazon S3 bucket
	const AWS = require('aws-sdk');
	const uploadLocation = response.uploadLocation;

	const s3 = new AWS.S3({
	    apiVersion: '2006-03-01',
	    region: 'us-east-1',
	    signatureVersion: 'v4',
	    endpoint: uploadLocation.endpoint,
	    credentials: new AWS.Credentials(
	        uploadLocation.accessKey,
	        uploadLocation.secretAccessKey,
	        uploadLocation.sessionToken)
	});

	// //upload file
	const input = 'data/aq_cg.zip';
	const fs = require('fs');
	await s3.upload({
	    Body: fs.createReadStream(input),
	    Bucket: uploadLocation.bucket,
	    Key: `${uploadLocation.prefix}aq_cg.zip`
	}).promise();
	// notify the finish
	const onComplete = response.onComplete;
	await request({
	    url: onComplete.url,
	    method: onComplete.method,
	    headers: { Authorization: `Bearer ${accessToken}` },
	    json: true,
	    body: onComplete.fields
	});

	async function waitUntilReady() {
	    const assetId = response.assetMetadata.id;

	    // Issue a GET request for the metadata
	    const assetMetadata = await request({
	        url: `https://api.cesium.com/v1/assets/${assetId}`,
	        headers: { Authorization: `Bearer ${accessToken}` },
	        json: true
	    });

	    const status = assetMetadata.status;
	    if (status === 'COMPLETE') {
	        console.log('Asset tiled successfully');
	        console.log(`View in ion: https://cesium.com/ion/assets/${assetMetadata.id}`);
	    } else if (status === 'DATA_ERROR') {
	        console.log('ion detected a problem with the uploaded data.');
	    } else if (status === 'ERROR') {
	        console.log('An unknown tiling error occurred, please contact support@cesium.com.');
	    } else {
	        if (status === 'NOT_STARTED') {
	            console.log('Tiling pipeline initializing.');
	        } else { // IN_PROGRESS
	            console.log(`Asset is ${assetMetadata.percentComplete}% complete.`);
	        }
	        // Not done yet, check again in 10 seconds
	        setTimeout(waitUntilReady, 10000);
    	}
	}
	waitUntilReady();
}
send_request();