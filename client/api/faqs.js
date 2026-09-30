import { faqs } from './_data.js'

export default function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.status(200).json(faqs)
}
