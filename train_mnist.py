"""
Train a high-accuracy MNIST Neural Network with Data Augmentation
and export weights for both Python (NumPy/PyTorch) and Web (JSON/JS).
"""

import os
import json
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader

# Set seeds
torch.manual_seed(42)
np.random.seed(42)

DATA_PATH = "mnist.npz"
if not os.path.exists(DATA_PATH):
    import urllib.request
    print("[*] Downloading mnist.npz...")
    urllib.request.urlretrieve("https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz", DATA_PATH)

print("[*] Loading MNIST dataset...")
data = np.load(DATA_PATH)
x_train = data['x_train'].astype(np.float32) / 255.0  # (60000, 28, 28)
y_train = data['y_train'].astype(np.int64)
x_test = data['x_test'].astype(np.float32) / 255.0    # (10000, 28, 28)
y_test = data['y_test'].astype(np.int64)

# Flatten to 784
x_train_flat = x_train.reshape(-1, 784)
x_test_flat = x_test.reshape(-1, 784)

train_dataset = TensorDataset(torch.from_numpy(x_train_flat), torch.from_numpy(y_train))
test_dataset = TensorDataset(torch.from_numpy(x_test_flat), torch.from_numpy(y_test))

train_loader = DataLoader(train_dataset, batch_size=128, shuffle=True)
test_loader = DataLoader(test_dataset, batch_size=256, shuffle=False)

# Lightweight, highly efficient 3-layer MLP: 784 -> 128 -> 64 -> 10
class MNISTNet(nn.Module):
    def __init__(self):
        super(MNISTNet, self).__init__()
        self.fc1 = nn.Linear(784, 128)
        self.relu1 = nn.ReLU()
        self.fc2 = nn.Linear(128, 64)
        self.relu2 = nn.ReLU()
        self.fc3 = nn.Linear(64, 10)

    def forward(self, x):
        h1 = self.relu1(self.fc1(x))
        h2 = self.relu2(self.fc2(h1))
        logits = self.fc3(h2)
        return logits, h1, h2

model = MNISTNet()
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.002, weight_decay=1e-5)
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=5, gamma=0.5)

print("[*] Training MNIST model (10 epochs)...")
epochs = 10
for epoch in range(epochs):
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0
    for batch_x, batch_y in train_loader:
        # Simple online augmentation: slight jitter to strengthen robustness
        if np.random.rand() > 0.5:
            jitter = (torch.randn_like(batch_x) * 0.03).clamp(0, 1)
            batch_x_aug = torch.clamp(batch_x + jitter, 0.0, 1.0)
        else:
            batch_x_aug = batch_x

        optimizer.zero_grad()
        logits, _, _ = model(batch_x_aug)
        loss = criterion(logits, batch_y)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * len(batch_y)
        preds = logits.argmax(dim=1)
        correct += (preds == batch_y).sum().item()
        total += len(batch_y)

    scheduler.step()
    train_acc = correct / total * 100.0

    # Evaluate on test set
    model.eval()
    test_correct = 0
    test_total = 0
    with torch.no_grad():
        for bx, by in test_loader:
            logits, _, _ = model(bx)
            preds = logits.argmax(dim=1)
            test_correct += (preds == by).sum().item()
            test_total += len(by)
    test_acc = test_correct / test_total * 100.0

    print(f"Epoch {epoch+1:02d}/{epochs:02d} | Loss: {total_loss/total:.4f} | Train Acc: {train_acc:.2f}% | Test Acc: {test_acc:.2f}%")

print(f"\n[+] Final Test Accuracy: {test_acc:.2f}%")

# Save PyTorch weights
torch.save(model.state_dict(), "mnist_model.pt")
print("[+] Saved PyTorch model: mnist_model.pt")

# Export weights to NumPy .npz
weights_dict = {
    'w1': model.fc1.weight.detach().cpu().numpy(),  # (128, 784)
    'b1': model.fc1.bias.detach().cpu().numpy(),    # (128,)
    'w2': model.fc2.weight.detach().cpu().numpy(),  # (64, 128)
    'b2': model.fc2.bias.detach().cpu().numpy(),    # (64,)
    'w3': model.fc3.weight.detach().cpu().numpy(),  # (10, 64)
    'b3': model.fc3.bias.detach().cpu().numpy(),    # (10,)
}
np.savez_compressed("mnist_weights.npz", **weights_dict)
print("[+] Saved NumPy weights: mnist_weights.npz")

# Export weights to JSON and JS for web browser zero-dependency execution
# Round to 5 decimal places to reduce file size while keeping 99.999% precision
web_weights = {
    'w1': np.round(weights_dict['w1'], 5).tolist(),
    'b1': np.round(weights_dict['b1'], 5).tolist(),
    'w2': np.round(weights_dict['w2'], 5).tolist(),
    'b2': np.round(weights_dict['b2'], 5).tolist(),
    'w3': np.round(weights_dict['w3'], 5).tolist(),
    'b3': np.round(weights_dict['b3'], 5).tolist(),
    'accuracy': round(test_acc, 2),
    'architecture': [784, 128, 64, 10]
}

with open("mnist_weights.json", "w", encoding="utf-8") as f:
    json.dump(web_weights, f)
print(f"[+] Saved JSON weights: mnist_weights.json ({os.path.getsize('mnist_weights.json') // 1024} KB)")

# Also write directly as a JS file so file:// origin without web server can load it immediately!
with open("mnist_weights.js", "w", encoding="utf-8") as f:
    f.write("// Pre-trained MNIST Neural Network Weights (Accuracy: " + str(round(test_acc, 2)) + "%)\n")
    f.write("window.MNIST_WEIGHTS = " + json.dumps(web_weights) + ";\n")
print(f"[+] Saved JS weights: mnist_weights.js ({os.path.getsize('mnist_weights.js') // 1024} KB)")
