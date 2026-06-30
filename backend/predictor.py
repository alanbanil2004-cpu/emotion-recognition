from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.inception_v3 import preprocess_input
import numpy as np
import os

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "model",
    "model_vgg19SVM.h5"
)

model = load_model(MODEL_PATH)

EMOTIONS = [
    "Veera",
    "Karuna",
    "Rowdra",
    "Haasya",
    "Shantha",
    "Singara",
    "Bhayanaka",
    "Adbhuta",
    "Bhibatsya"
]

def predict_emotion(img_path):

    img = image.load_img(
        img_path,
        target_size=(224,224)
    )

    x = image.img_to_array(img)

    x = np.expand_dims(x, axis=0)

    img_data = preprocess_input(x)

    prediction = model.predict(img_data, verbose=0)

    class_index = np.argmax(prediction)

    confidence = float(prediction[0][class_index])

    return {
        "emotion": EMOTIONS[class_index],
        "confidence": round(confidence * 100, 2)
    }   