// const fs = require('fs');
// const path = require('path');
const express = require('express');
const stream = require('stream');
const Spotify = require('spotifydl-core').default;
const spotify = new Spotify({
  // Authentication
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
});
const NodeID3 = require('node-id3');
const axios = require('axios');
var cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.post('/songDetails', async (req, res) => {
  const spotifyUrl = req.body.spotifyUrl;

  if (!spotifyUrl) {
    res.status(400).json({ message: 'Missing spotifyUrl!' });
    return;
  }

  const data = await spotify.getTrack(spotifyUrl);
  console.log(data);
  res.json(data);
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

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
