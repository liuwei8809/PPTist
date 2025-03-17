import axios from './config'

// export const SERVER_URL = 'http://localhost:5000'
export const SERVER_URL = (import.meta.env.MODE === 'development') ? '/api' : 'https://aiapp.tenwhale.com'
export const ASSET_URL = 'https://asset.tenwhale.com'

export default {
  getMockData(filename: string): Promise<any> {
    return axios.get(`./mocks/${filename}.json`)
  },

  getFileData(filename: string): Promise<any> {
    return axios.get(`${ASSET_URL}/data/${filename}.json`)
  },

  AIPPT_Outline(
    content: string,
    language: string,
    model: string,
  ): Promise<any> {
    return fetch(`${SERVER_URL}/v1/completion-messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer '+ import.meta.env.VITE_OUTLINE_ACCESS_TOKEN
      },
      body: JSON.stringify({
        "inputs":{"query":content},
        "response_mode": "streaming",
        "user": "aippt-web-agent"
      }),
    })
  },


  AIPPT(
    content: string,
    language: string,
    model: string,
  ): Promise<any> {
    return fetch(`${SERVER_URL}/v1/completion-messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer '+ import.meta.env.VITE_PPT_ACCESS_TOKEN
      },
      body: JSON.stringify({
        "inputs":{"content":content},
        "response_mode": "streaming",
        "user": "aippt-web-agent"
      }),
    })
  },
}