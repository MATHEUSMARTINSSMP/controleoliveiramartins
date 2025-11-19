// Utility function to normalize CPF (remove dots, dashes, spaces)
export const normalizeCPF = (cpf: string): string => {
    if (!cpf) return "";
    return cpf.replace(/[.\-\s]/g, "");
};

// Format CPF for display (000.000.000-00)
export const formatCPF = (cpf: string): string => {
    const normalized = normalizeCPF(cpf);
    if (normalized.length !== 11) return cpf;

    return normalized.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
    );
};
