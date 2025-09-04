import React from 'react';

function WeightsForm({ weights, setWeights }) {
  function handleChange(e) {
    setWeights({ ...weights, [e.target.name]: parseFloat(e.target.value) });
  }
  
  // Calculate the sum of weights
  const weightSum = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const isValidSum = Math.abs(weightSum - 100) <= 1; // Allow small rounding errors
  
  return (
    <div className="form-group mb-4">
      <h3>Scoring Weights</h3>
      <div className="weights-grid">
        {['skills', 'experience', 'education', 'industry'].map(field => {
          const id = `weight-${field}`;
          return (
            <div key={field} className="weight-item">
              <label htmlFor={id} className="form-label">
                {field.charAt(0).toUpperCase() + field.slice(1)}:
              </label>
              <input
                id={id}
                type="number"
                min={0}
                max={100}
                step={1}
                name={field}
                value={weights[field]}
                onChange={handleChange}
                className="form-control"
                aria-label={`${field} weight`}
              />
            </div>
          );
        })}
      </div>
      <div className="weight-sum-indicator">
        <small className={isValidSum ? 'weight-sum-valid' : 'weight-sum-invalid'}>
          Sum: {weightSum} (should be 100)
        </small>
      </div>
    </div>
  );
}

export default WeightsForm;
