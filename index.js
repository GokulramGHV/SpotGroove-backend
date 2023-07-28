const express = require('express');
const stream = require('stream');
const Spotify = require('spotifydl-core').default;
const spotify = new Spotify({
    // Authentication
    clientId: process.env['CLIENT_ID'],
    clientSecret: process.env['CLIENT_SECRET'],
});
const NodeID3 = require('node-id3');
const axios = require('axios');
var cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const client_id = process.env["CLIENT_ID"]; // Your client id
const client_secret = process.env['CLIENT_SECRET']; // Your secret
const auth_token = Buffer.from(`${client_id}:${client_secret}`, 'utf-8').toString('base64');
const PORT = process.env["PORT"];

const getAuth = async () => {
    try {
        //make post request to SPOTIFY API for access token, sending relavent info
        const token_url = 'https://accounts.spotify.com/api/token';
        const data = { 'grant_type': 'client_credentials' };

        const response = await axios.post(token_url, data, {
            headers: {
                'Authorization': `Basic ${auth_token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
        //return access token
        return response.data.access_token;
        //console.log(response.data.access_token);   
    } catch (error) {
        //on fail, log the error in console
        console.log(error);
    }
}

app.get('/searchTrack', async (req, res) => {

    const TOKEN = await getAuth();
    const query = req.query.search;
    console.log(query);
    if (!query) {
        res.status(400).json({ message: 'Missing search query!' });
        return;
    }
    // const encodedQuery = encodeURIComponent(query);
    const limit = 5;
    const offset = req.query.offset || 0;
    const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=${limit}&offset=${offset}`;
    // console.log('TOKEN', process.env["TOKEN"]);
    // return res.json({ url });
    const response = await axios.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const data = response.data.tracks.items.map((item) => {
        return {
            name: item.name,
            artists: item.artists.map((artist) => artist.name),
            spotifyUrl: item.external_urls.spotify,
            cover_url: item.album.images[0].url,
            album_name: item.album.name,
        };
    });

    res.json(data);
});

app.post('/songDetails', async (req, res) => {
    const spotifyUrl = req.body.spotifyUrl;

    if (!spotifyUrl) {
        res.status(400).json({ message: 'Missing spotifyUrl!' });
        return;
    }
    try {
        const data = await spotify.getTrack(spotifyUrl);
        console.log(data);
        res.json(data);
    } catch (err) {
        console.log(err);
        res.status(400).json({ message: "Invalid URL" })
    }

});

app.post('/download', async (req, res) => {
    // URL of a Spotify track
    const spotifyUrl = req.body.spotifyUrl;

    if (!spotifyUrl) {
        res.status(400).json({ message: 'Missing spotifyUrl!' });
        return;
    }

    const data = await spotify.getTrack(spotifyUrl); // Waiting for the data 🥱
    console.log(data);

    // Assuming you have a buffer containing the MP3 file

    // URL of the image
    const imageUrl = data.cover_url;

    console.log('Downloading: ', data.name, 'by:', data.artists.join(', ')); // Keep an eye on the progress
    let start = Date.now();
    const song = await spotify.downloadTrack(spotifyUrl); // Downloading goes brr brr
    console.log(`\ndone, thanks - ${(Date.now() - start) / 1000}s`);
    console.log('After Download, before send!');

    // Fetch the image from the URL
    axios
        .get(imageUrl, { responseType: 'arraybuffer' })
        .then((response) => {
            // Convert array buffer to Buffer
            const coverImageBuffer = Buffer.from(response.data, 'binary');

            // Write the new tag with the cover image
            const mp3WithTagBuffer = NodeID3.update(
                {
                    image: {
                        mime: 'image/jpeg', // The MIME type of the image (e.g., image/jpeg, image/png)
                        type: { id: 3, name: 'front cover' }, // The type of the image (3 for front cover)
                        description: 'Cover Image', // The description of the image (optional)
                        imageBuffer: coverImageBuffer, // The buffer containing the cover image
                    },
                },
                song
            );

            console.log('After read stream!');
            // Set the appropriate headers
            res.setHeader('Content-Disposition', `attachment; filename="${data.name}.mp3"`); // Replace 'filename.extension' with the desired filename and its extension
            res.setHeader('Content-Type', 'application/octet-stream');

            // Pipe the read stream to the response stream
            let readStream = new stream.PassThrough();
            readStream.end(mp3WithTagBuffer);
            readStream.pipe(res);
            console.log('After pipe!');
        })
        .catch((error) => {
            console.error('Error fetching image:', error);
            res.status(500).json({ message: 'Error fetching image!' });
        });
});

app.get('/', (req, res) => {
    res.send('Server is running!');
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on port ${PORT}`);
    console.log(new Date())
});
