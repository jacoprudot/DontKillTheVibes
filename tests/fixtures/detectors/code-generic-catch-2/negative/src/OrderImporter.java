// code-generic-catch-2 negative: the handler catches IOException, not the generic Exception, so it must NOT fire; a naive `catch (...*Exception` scan would flag it.
package com.acme.orders;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class OrderImporter {

    public String readCsv(Path path) {
        try {
            return Files.readString(path);
        } catch (IOException e) {
            return "";
        }
    }
}
