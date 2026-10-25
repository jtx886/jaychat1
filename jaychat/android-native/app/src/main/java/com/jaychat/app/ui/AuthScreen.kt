package com.jaychat.app.ui

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jaychat.app.MainViewModel
import kotlinx.coroutines.delay

@Composable
fun AuthScreen(vm: MainViewModel) {
    var register by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(Bg)) {
        if (register) RegisterForm(vm) { register = false }
        else LoginForm(vm) { register = true }
    }
}

@Composable
private fun Logo() {
    Box(
        Modifier
            .size(64.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(Primary),
        contentAlignment = Alignment.Center
    ) {
        Text("J", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun LoginForm(vm: MainViewModel, onRegister: () -> Unit) {
    val ctx = LocalContext.current
    var account by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(96.dp))
        Logo()
        Spacer(Modifier.height(14.dp))
        Text("Jay Chat", color = TextMain, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text("登录后继续聊天", color = TextSub, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
        Spacer(Modifier.height(38.dp))

        OutlinedTextField(
            value = account,
            onValueChange = { account = it; error = null },
            label = { Text("账号 / 邮箱") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it; error = null },
            label = { Text("密码") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )

        if (error != null) {
            Text(
                error!!,
                color = Danger,
                fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
            )
        }

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = {
                if (account.isBlank() || password.isBlank()) {
                    error = "请输入账号和密码"
                    return@Button
                }
                vm.login(account, password) { err ->
                    if (err != null) {
                        error = err
                        Toast.makeText(ctx, err, Toast.LENGTH_SHORT).show()
                    }
                }
            },
            enabled = !vm.busy,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(14.dp)
        ) {
            if (vm.busy) {
                CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
            } else {
                Text("登录", fontSize = 16.sp)
            }
        }

        Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("还没有账号？", color = TextSub, fontSize = 13.sp)
            TextButton(onClick = onRegister) { Text("注册", color = Primary, fontSize = 13.sp) }
        }
        Text(
            "服务器：" + com.jaychat.app.Store.base,
            color = TextSub,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 18.dp)
        )
    }
}

@Composable
private fun RegisterForm(vm: MainViewModel, onBack: () -> Unit) {
    val ctx = LocalContext.current
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var countdown by remember { mutableIntStateOf(0) }

    LaunchedEffect(countdown) {
        if (countdown > 0) {
            delay(1000)
            countdown -= 1
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(60.dp))
        Logo()
        Spacer(Modifier.height(14.dp))
        Text("注册 Jay Chat", color = TextMain, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(26.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it; error = null },
            label = { Text("邮箱（仅支持 @qq.com / @163.com）") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = code,
                onValueChange = { code = it; error = null },
                label = { Text("邮箱验证码") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f)
            )
            Spacer(Modifier.size(10.dp))
            Button(
                onClick = {
                    if (email.isBlank()) {
                        error = "请先输入邮箱"
                        return@Button
                    }
                    vm.sendCode(email) { hint, err ->
                        if (err != null) {
                            error = err
                        } else {
                            countdown = 60
                            Toast.makeText(ctx, hint ?: "验证码已发送", Toast.LENGTH_LONG).show()
                        }
                    }
                },
                enabled = countdown == 0,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Card2),
                modifier = Modifier.height(52.dp)
            ) {
                Text(if (countdown > 0) "${countdown}s" else "获取", fontSize = 13.sp)
            }
        }

        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = username,
            onValueChange = { username = it; error = null },
            label = { Text("昵称") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it; error = null },
            label = { Text("密码（至少 6 位）") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )

        if (error != null) {
            Text(
                error!!,
                color = Danger,
                fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
            )
        }

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = {
                if (email.isBlank() || code.isBlank() || username.isBlank() || password.isBlank()) {
                    error = "请填写所有信息"
                    return@Button
                }
                vm.register(email, code, username, password) { err ->
                    if (err != null) {
                        error = err
                        Toast.makeText(ctx, err, Toast.LENGTH_SHORT).show()
                    }
                }
            },
            enabled = !vm.busy,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(14.dp)
        ) {
            if (vm.busy) {
                CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
            } else {
                Text("注册并登录", fontSize = 16.sp)
            }
        }

        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.Center) {
            Text("已有账号？", color = TextSub, fontSize = 13.sp)
            TextButton(onClick = onBack) { Text("返回登录", color = Primary, fontSize = 13.sp) }
        }
        Spacer(Modifier.height(30.dp))
    }
}
