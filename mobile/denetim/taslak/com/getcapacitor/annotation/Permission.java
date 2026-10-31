package com.getcapacitor.annotation; public @interface Permission { String[] strings() default {}; String alias() default ""; }
