const FormGroup = ({ label, placeholder, value, onChange, type = "text", name }) => {
    const fieldName = name ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
        <div className="form-group">
            <label htmlFor={fieldName}>{label}</label>
            <input
                type={type}
                id={fieldName}
                name={fieldName}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
            />
        </div>
    )
}

export default FormGroup;
