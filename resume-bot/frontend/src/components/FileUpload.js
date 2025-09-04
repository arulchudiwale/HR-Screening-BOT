import React from 'react';

function FileUpload({ label, multiple, onChange, accept }) {
  const id = `file-upload-${label.replace(/\s+/g, '-').toLowerCase()}`;
  
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label}</label>
      <input
        id={id}
        type="file"
        className="form-control file-input"
        multiple={multiple}
        onChange={onChange}
        accept={accept}
        aria-label={label}
      />
      <small className="form-text">
        {multiple ? 'You can select multiple files' : 'Select a single file'} (PDF or DOCX)
      </small>
    </div>
  );
}

export default FileUpload;
