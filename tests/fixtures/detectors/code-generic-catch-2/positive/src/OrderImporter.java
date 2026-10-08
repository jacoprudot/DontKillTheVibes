// code-generic-catch-2 positive: the handler catches the generic Exception, so this file MUST fire.
package com.acme.orders;

import java.nio.file.Files;
import java.nio.file.Path;

public class OrderImporter {

    public String readCsv(Path path) {
        try {
            return Files.readString(path);
        } catch (Exception e) {
            return "";
        }
    }
}
