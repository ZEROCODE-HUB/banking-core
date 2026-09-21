// Script temporal para verificar display_name en la base de datos
// Ejecutar en la consola del navegador

console.log('🔍 Verificando datos del usuario actual:');
console.log('Auth context user:', window?.authContext?.user);
console.log('Display name from auth:', window?.authContext?.user?.displayName);
console.log('Display name from userData:', window?.authContext?.user?.userData?.display_name);
console.log('Email:', window?.authContext?.user?.email);

// También puedes ejecutar esto en la consola:
// const { useAuth } = require('@/contexts/AuthContext');
// const { user } = useAuth();
// console.log('User data:', user);