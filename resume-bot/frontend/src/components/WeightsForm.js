import React from 'react';

function WeightsForm({ weights, setWeights }) {
  function handleChange(e) {
    setWeights({ ...weights, [e.target.name]: parseFloat(e.target.value) });
  }
  return (
    <div>
      <h3>Scoring Weights</h3>
      {['skills', 'experience', 'education', 'industry'].map(field => (
        <div key={field}>
          <label>{field.charAt(0).toUpperCase() + field.slice(1)}: </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            name={field}
            value={weights[field]}
            onChange={handleChange}
          />
        </div>
      ))}
      <small>Sum should be 100</small>
    </div>
  );
}

export default WeightsForm;
