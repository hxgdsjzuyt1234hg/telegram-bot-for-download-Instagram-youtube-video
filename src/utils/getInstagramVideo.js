import axios from 'axios';


const getInstagramDownloadLink = async (url) => {
    const options = {
        method: 'POST',
        url: 'https://save-insta1.p.rapidapi.com/media',
        headers: {
            'x-rapidapi-key': 'd0b2a0cdbemsh8a37f327d444afbp15494bjsnbb012bd01fa7',
            'x-rapidapi-host': 'save-insta1.p.rapidapi.com',
            'Content-Type': 'application/json'
        },
        data: { url }
    };

    try {
        const response = await axios.request(options);
        const URL = (response?.data?.result?.[0]?.urls?.[0]?.url);
        return URL;
    } catch (error) {
        console.error(error);
        return null;
    }
};

export { getInstagramDownloadLink };
