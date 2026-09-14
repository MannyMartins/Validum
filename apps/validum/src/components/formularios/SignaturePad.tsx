import React from 'react';
import { EnhancedSignatureField } from '../folio/EnhancedSignatureField';

interface SignaturePadProps {
  value?: string;
  onChange: (pngDataUrl: string) => void;
  label?: string;
  required?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  value = '',
  onChange,
  label = 'Firma Digital',
  required = false
}) => {
  return (
    <EnhancedSignatureField
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      height={160}
    />
  );
};

export default SignaturePad;
