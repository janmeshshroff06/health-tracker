package com.healthapp

import android.os.Bundle
import android.widget.Button
import androidx.activity.ComponentActivity

class PermissionsRationaleActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_permissions_rationale)
    title = getString(R.string.health_permissions_rationale_title)

    findViewById<Button>(R.id.permissions_rationale_close_button).setOnClickListener {
      finish()
    }
  }
}
