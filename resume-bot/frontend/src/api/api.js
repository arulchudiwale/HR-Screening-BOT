import axios from 'axios';

const BASE_URL = process.env.REACT_APP_BACKEND_URL;

export async function evaluateResumes(formData) {
  const res = await axios.post(
    `${BASE_URL}/evaluate`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data;
}
