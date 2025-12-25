import React from "react";

/**
 * Obtém o caminho da logo baseado no ID da loja
 * @param storeId - ID da loja (pode ser store_id ou store_default que contém o ID)
 * @returns Caminho da logo ou null se não encontrada
 */
export const getStoreLogo = (storeId: string | null | undefined): string | null => {
  if (!storeId) return null;
  
  // Mapeamento dos IDs das lojas para os arquivos de logo
  const logoMap: Record<string, string> = {
    '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b': '/5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b.png', // Loungerie
    'c6ecd68d-1d73-4c66-9ec5-f0a150e70bb3': '/c6ecd68d-1d73-4c66-9ec5-f0a150e70bb3.png', // Mr. Kitsch
    'cee7d359-0240-4131-87a2-21ae44bd1bb4': '/cee7d359-0240-4131-87a2-21ae44bd1bb4.png', // Sacada | Oh, Boy
  };

  return logoMap[storeId] || null;
};

/**
 * Obtém o store_id de um perfil
 * 
 * - Para LOJA: store_default contém o ID da loja
 * - Para COLABORADORA: usar store_id se disponível, senão store_default
 * - Para ADMIN: retorna null (ADMINs podem ter múltiplas lojas, necessário selecionar uma loja específica)
 * 
 * @param profile - Perfil do usuário
 * @returns ID da loja ou null se não encontrado
 */
export const getStoreIdFromProfile = (profile: { store_id?: string | null; store_default?: string | null; role?: string } | null): string | null => {
  if (!profile) return null;
  
  // Para LOJA, store_default contém o ID da loja
  if (profile.role === 'LOJA') {
    return profile.store_default || null;
  }
  
  // Para ADMIN, não retorna store_id porque pode ter múltiplas lojas
  // Módulos que precisam de store_id devem ter um seletor de loja para ADMIN
  if (profile.role === 'ADMIN') {
    // ADMIN pode ter store_id ou store_default, mas geralmente terá múltiplas lojas
    // Retornar store_id ou store_default se existir, senão null
    // Nota: Para módulos que precisam de isolamento por loja, considerar implementar seletor de loja
    return profile.store_id || profile.store_default || null;
  }
  
  // Para COLABORADORA, usar store_id se disponível, senão store_default
  return profile.store_id || profile.store_default || null;
};

/**
 * Componente para exibir a logo de uma loja
 */
export const StoreLogo = ({ 
  storeId, 
  className = "w-12 h-12 object-contain",
  alt = "Logo da loja"
}: { 
  storeId: string | null | undefined;
  className?: string;
  alt?: string;
}) => {
  const logoPath = getStoreLogo(storeId);
  
  if (!logoPath) return null;
  
  return (
    <img 
      src={logoPath} 
      alt={alt}
      className={className}
      onError={(e) => {
        // Fallback: ocultar se a imagem não carregar
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
};

