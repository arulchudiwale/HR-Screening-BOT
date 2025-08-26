import React from 'react';

function FileUpload({ label, multiple, onChange }) {
  return (
    <div>
      <label>{label}</label>
      <input
        type="file"
        multiple={multiple}
        onChange={onChange}
        accept=".pdf,.docx"
      />
    </div>
  );
}

export default FileUpload;
