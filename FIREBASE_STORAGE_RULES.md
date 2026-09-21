# Configuración de Reglas de Firebase Storage

## SOLUCIÓN RÁPIDA - Reglas Ultra Simples

Para resolver inmediatamente el error 403, usa estas reglas **TEMPORALES** en Firebase Storage:

### 🚨 REGLAS DE EMERGENCIA (solo para desarrollo):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Regla temporal - permite todo para usuarios autenticados
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 📋 PASOS RÁPIDOS:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: `alianza-b7y88v`
3. **Storage** → **Rules**
4. **Pega las reglas de arriba**
5. **Publish**

## Cambios en el Código

El código ahora usa rutas ultra simples:
- **Todo se guarda en**: `/archivos/nombre_del_archivo`
- **Sin subcarpetas complejas**
- **Descarga automática del PDF si falla**
- **Referencias locales para archivos que no se suben**

## ⚠️ IMPORTANTE

Estas reglas son **TEMPORALES** para desarrollo. Para producción usar:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /archivos/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
        && resource == null; // Solo crear, no modificar
    }
  }
}
```