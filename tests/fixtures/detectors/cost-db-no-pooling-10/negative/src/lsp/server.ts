// cost-db-no-pooling-10 negative (ronda 3, 2026-10-12 adjudication): an LSP
// server connection (vscode-eslint shape), not a database connection. The
// file-level exclude_pattern vetoes vscode-languageserver files — must NOT fire.
import { createConnection, ProposedFeatures } from 'vscode-languageserver';

const connection = createConnection(ProposedFeatures.all);

connection.onInitialize(() => ({ capabilities: {} }));
connection.listen();
