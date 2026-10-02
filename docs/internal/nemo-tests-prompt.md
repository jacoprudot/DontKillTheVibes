# Tarea: Fase 5 - Tests Unitarios para MCPs (DontKillTheVibes)

Hola Nemo. Eres el agente encargado de la infraestructura y pruebas para nuestro proyecto `DontKillTheVibes`. Hemos cerrado las Fases 3 y 4 exitosamente y el código de implementación está funcional, validado y seguro. Ahora estamos en la **Fase 5**.

Tu tarea exclusiva para esta sesión es **escribir los Tests Unitarios** para nuestros servidores MCP personalizados (`mcps/git-mcp` y `mcps/benchmark-mcp`) para alcanzar la cobertura de código requerida (`>80%`) por nuestro Quality Gate.

## Contexto y Restricciones (¡IMPORTANTE!)
1. **NO modifiques el código fuente de implementación**. Todo el código en `src/` ya fue auditado en temas de seguridad y funcionalidad. Tu trabajo es *testearlo*, no reescribirlo. Si encuentras un bug, documéntalo, pero no lo arregles a menos que bloquee tu test.
2. **Lee los contratos**: Antes de escribir una sola línea de código, debes leer:
   - `HANDOFF.md` (Punto 1 de Brechas conocidas).
   - `BUILD_PLAN.md` (Sección 8.1 - Unit Tests).
3. **Usa Jest**: Ya está configurado. Tienes que mockear TODAS las dependencias externas (`child_process`, `fs`, llamadas de red, APIs de GitHub o Git real). Las pruebas deben correr rápido y sin dependencias del entorno.

## Tu plan de trabajo (Ejecuta esto paso a paso):

### Paso 1: Configuración de Jest
- Revisa el `package.json` de `mcps/git-mcp` y `mcps/benchmark-mcp` para asegurarte de que `jest`, `ts-jest` y `@types/jest` están instalados como `devDependencies`. Si no, instálalos usando `pnpm --filter git-mcp add -D ...`
- Crea un `jest.config.js` básico en cada paquete MCP.

### Paso 2: Tests para `git-mcp`
- Crea la carpeta `__tests__` o sufijos `.test.ts` para las herramientas (`get-blame.ts`, `get-diff-since.ts`, etc.) y el `git-wrapper.ts`.
- Mockea `execFileSync` de `child_process` para simular las salidas de los comandos de git.
- Asegúrate de cubrir caminos felices, errores y validaciones de path.

### Paso 3: Tests para `benchmark-mcp`
- Escribe pruebas para `sandbox.ts` (verifica que el env se restringe correctamente).
- Escribe pruebas para herramientas clave como `profile-code.ts` y `run-benchmark.ts`.
- Mockea la creación de directorios temporales y la ejecución de comandos.

### Entregable Final:
- Ejecuta `pnpm test` desde la raíz y muéstrame que los tests de ambos MCPs corren exitosamente y reportan la cobertura de código (`--coverage`).
- Solo detente cuando la cobertura de líneas alcance o supere el **80%**.

¡Adelante! Empieza leyendo el `HANDOFF.md` y revisando la estructura actual de los MCPs.
