# AIR-Code

Extensión de Visual Studio Code para análisis de impacto de código mediante técnicas avanzadas de parsing y análisis estático.

## Características

- **Análisis de Impacto**: Identifica qué archivos se verán afectados por un cambio propuesto
- **Visualización Gráfica**: Muestra dependencias entre archivos usando gráficos de fuerza D3
- **Extracción de Símbolos**: Parsea código TypeScript, JavaScript y Python usando Tree-sitter
- **Docstrings Inteligentes**: Extrae comentarios JSDoc y docstrings de Python automáticamente
- **Snippets de Código**: Genera fragmentos relevantes del código analizado
- **Integración con IA**: Explicaciones generadas por OpenAI sobre el impacto del cambio
- **Métricas de Riesgo**: Calcula riesgo basado en fan-out, commits recientes y complejidad ciclomática

## Instalación

### Requisitos Previos

- Node.js 18+ 
- pnpm (`npm install -g pnpm`)
- Visual Studio Code

### Pasos de Instalación

```bash
# Clonar el repositorio
git clone <repo-url>
cd aircode

# Instalar dependencias
pnpm install

# Construir todos los paquetes
pnpm build

# Empaquetar la extensión
cd packages/extension
pnpm vsce package

# Instalar en VS Code
code --install-extension aircode-*.vsix
```

## Uso

### Comandos Disponibles

1. **AIR-Code: Analizar Idea** (`Ctrl+Shift+P` → `AIR-Code: Analizar Idea`)
   - Describe el cambio que quieres implementar
   - Ejemplo: "Agregar autenticación con OAuth2"

2. **AIR-Code: Reindexar Todo**
   - Reconstruye el índice completo del workspace
   - Útil después de cambios grandes en el código

3. **AIR-Code: Explicar con IA**
   - Genera una explicación detallada usando OpenAI
   - Requiere configurar `aircode.openaiApiKey` en settings

### Configuración

Agrega esto a tu `settings.json`:

```json
{
  "aircode.openaiApiKey": "sk-...",
  "aircode.apiEndpoint": "https://api.openai.com/v1/chat/completions"
}
```

## Arquitectura

El proyecto es un monorepo con los siguientes paquetes:

| Paquete | Descripción |
|---------|-------------|
| `@aircode/core` | Lógica principal con Tree-sitter, DuckDB y Git |
| `aircode` | Extensión de VS Code |
| `@aircode/webview-ui` | Interfaz React con visualizaciones |
| `@aircode/shared` | Tipos y utilidades compartidas |

## Tecnologías

- **Tree-sitter**: Parsing de código multi-lenguaje
- **DuckDB**: Base de datos embebida para consultas rápidas
- **D3.js**: Visualizaciones interactivas
- **React + Vite**: UI del dashboard
- **TypeScript**: Tipo seguro en todo el proyecto

## Contribución

1. Fork el repositorio
2. Crea una rama feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.
